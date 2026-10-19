import "server-only";
import crypto from "node:crypto";
import type { FieldPacket, RowDataPacket } from "mysql2/promise";
import { hisDb, exec, one } from "./db";
import { addDays, fiscalRange, isYmd } from "./dates";
import { defaultValue, isEmptyValue } from "./param-defaults";
import type { ColType, ColumnDef, ParamDef, ParamValue, ParamValues, RunResult } from "./report-types";

export class ReportError extends Error {}

// ---------------------------------------------------------------- SQL safety

/** ลบ comment และแทน string literal ด้วยช่องว่าง เพื่อใช้ตรวจโครงสร้าง SQL */
function skeleton(sql: string) {
  let out = "";
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], n = sql[i + 1];
    if (c === "'" || c === '"' || c === "`") {
      const q = c;
      out += " ";
      for (i++; i < sql.length; i++) {
        if (sql[i] === "\\") { i++; continue; }
        if (sql[i] === q) { if (sql[i + 1] === q) { i++; continue; } break; }
      }
      continue;
    }
    if ((c === "-" && n === "-") || c === "#") { while (i < sql.length && sql[i] !== "\n") i++; out += "\n"; continue; }
    if (c === "/" && n === "*") { i += 2; while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++; i++; out += " "; continue; }
    out += c;
  }
  return out;
}

// ตัวแปร session ที่ยอมให้ขึ้นต้นคิวรี่ได้ (คิวรี่เดิมบางตัวใช้ SET SESSION group_concat_max_len = ...;)
const ALLOWED_SET_VARS = new Set(["group_concat_max_len"]);
const SET_PREFIX = /^\s*SET\s+(?:SESSION\s+|@@session\.)?([a-z_]+)\s*=\s*(\d{1,12})\s*;/i;

/** แยก SET ... ; ที่ขึ้นต้นคิวรี่ออกมา เพื่อใส่ใน SET STATEMENT แทน (ไม่เปลี่ยนค่าของ connection) */
export function splitSessionVars(sql: string) {
  const vars: [string, number][] = [];
  let body = sql;
  let m: RegExpExecArray | null;
  while ((m = SET_PREFIX.exec(body))) {
    const name = m[1].toLowerCase();
    if (!ALLOWED_SET_VARS.has(name)) throw new ReportError(`ไม่อนุญาตให้ตั้งค่า ${name} ในรายงาน`);
    vars.push([name, Number(m[2])]);
    body = body.slice(m[0].length);
  }
  return { vars, body };
}

/** อนุญาตเฉพาะคำสั่ง SELECT เดียว (ฐาน HIS ยังถูกตั้ง READ ONLY อีกชั้น) */
export function assertSelectOnly(sql: string) {
  const s = skeleton(splitSessionVars(sql).body).trim().replace(/;\s*$/, "");
  if (!s) throw new ReportError("ยังไม่มีคำสั่ง SQL");
  if (s.includes(";")) throw new ReportError("ใส่ได้เพียงคำสั่งเดียว (พบเครื่องหมาย ;)");
  if (!/^(\(\s*)*(select|with)\b/i.test(s)) throw new ReportError("อนุญาตเฉพาะคำสั่ง SELECT / WITH");
  if (/\binto\s+(outfile|dumpfile)\b|\bload_file\s*\(|\bfor\s+update\b/i.test(s)) {
    throw new ReportError("คำสั่งนี้ไม่อนุญาตในรายงาน");
  }
}

// ---------------------------------------------------------------- params

const TOKEN = /\{([A-Za-z_]\w*)(?:\.(start|end|end_next))?\}/g;

/** ตรวจและจัดรูปค่าที่ผู้ใช้ส่งมา */
export function normalizeValues(defs: ParamDef[], raw: ParamValues | undefined): { values: ParamValues; errors: string[] } {
  const values: ParamValues = {};
  const errors: string[] = [];
  for (const d of defs) {
    let v: ParamValue = raw && d.name in raw ? raw[d.name] : defaultValue(d);
    switch (d.type) {
      case "daterange":
        if (v && typeof v === "object" && !Array.isArray(v)) {
          if (!isYmd(v.start) || !isYmd(v.end)) errors.push(`${d.label}: วันที่ไม่ถูกต้อง`);
          else if (v.start > v.end) errors.push(`${d.label}: วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด`);
        } else v = null;
        break;
      case "date":
        if (typeof v !== "string" || (v && !isYmd(v))) { if (v) errors.push(`${d.label}: วันที่ไม่ถูกต้อง`); v = null; }
        break;
      case "fiscal_year":
        if (typeof v !== "string" || !/^25\d{2}$/.test(v)) { errors.push(`${d.label}: ปีงบประมาณไม่ถูกต้อง`); v = null; }
        break;
      case "number": {
        const list = Array.isArray(v) ? v : [v as string];
        if (list.some((x) => x !== "" && x !== null && Number.isNaN(Number(x)))) errors.push(`${d.label}: ต้องเป็นตัวเลข`);
        break;
      }
      case "icd10": {
        const norm = (x: string) => x.trim().toUpperCase().replace(".", "");
        if (Array.isArray(v)) v = v.map(norm);
        else if (typeof v === "string") v = norm(v);
        const list = Array.isArray(v) ? v : [v as string];
        if (list.some((x) => x && !/^[A-Z][0-9A-Z]{1,6}$/.test(x))) errors.push(`${d.label}: รูปแบบรหัส ICD10 ไม่ถูกต้อง`);
        break;
      }
      default:
        if (d.multiple && typeof v === "string") v = v ? [v] : [];
        if (!d.multiple && Array.isArray(v)) v = v[0] ?? "";
    }
    if (d.required && isEmptyValue(v)) errors.push(`กรุณาระบุ ${d.label}`);
    values[d.name] = v;
  }
  return { values, errors };
}

function tokenValue(def: ParamDef, v: ParamValue, sub: string | undefined): unknown {
  if (def.type === "daterange") {
    const r = v as { start: string; end: string };
    if (sub === "start") return r.start;
    if (sub === "end") return r.end;
    if (sub === "end_next") return addDays(r.end, 1);
    throw new ReportError(`ตัวแปร {${def.name}} ต้องใช้ .start / .end / .end_next`);
  }
  if (def.type === "fiscal_year") {
    const fy = fiscalRange(Number(v));
    if (sub === "start") return fy.start;
    if (sub === "end") return fy.end;
    if (sub === "end_next") return addDays(fy.end, 1);
    return Number(v);
  }
  if (def.type === "number") return Array.isArray(v) ? v.map(Number) : Number(v);
  return v;
}

/**
 * แปลง SQL ของรายงานเป็น SQL + ค่าพารามิเตอร์ (?)
 * - {name} / {name.start} / {name.end} / {name.end_next}
 * - [[ ... ]] เงื่อนไขเสริม: ถ้าตัวแปรข้างในว่าง ตัดทั้งบล็อกทิ้ง
 * - ตัวแปรหลายค่า ขยายเป็น ?,?,? (ใช้กับ IN (...))
 */
export function compileSql(sql: string, defs: ParamDef[], values: ParamValues) {
  const byName = new Map(defs.map((d) => [d.name, d]));
  const withOptional = sql.replace(/\[\[([\s\S]*?)\]\]/g, (_m, inner: string) => {
    const names = [...inner.matchAll(TOKEN)].map((t) => t[1]);
    return names.some((n) => isEmptyValue(values[n])) ? "" : inner;
  });
  const args: unknown[] = [];
  const out = withOptional.replace(TOKEN, (_m, name: string, sub: string | undefined) => {
    const def = byName.get(name);
    if (!def) throw new ReportError(`ไม่พบการกำหนดตัวแปร {${name}}`);
    const v = values[name];
    if (isEmptyValue(v)) throw new ReportError(`ตัวแปร ${def.label} ว่าง (ถ้าไม่บังคับ ให้ครอบด้วย [[ ]])`);
    const val = tokenValue(def, v, sub);
    if (Array.isArray(val)) { args.push(...val); return val.map(() => "?").join(","); }
    args.push(val);
    return "?";
  });
  return { sql: out, args };
}

/** ชื่อตัวแปรที่อ้างใน SQL (ใช้ปุ่ม "ดึงตัวแปรจาก SQL") */
export function tokensInSql(sql: string) {
  const found = new Map<string, Set<string>>();
  for (const t of sql.matchAll(TOKEN)) {
    if (!found.has(t[1])) found.set(t[1], new Set());
    if (t[2]) found.get(t[1])!.add(t[2]);
  }
  return [...found.entries()].map(([name, subs]) => ({ name, subs: [...subs] }));
}

// ---------------------------------------------------------------- run

/**
 * คิวคิวรี่รายงานไปที่ HIS (รวมทุกผู้ใช้ทั้ง server) — รันพร้อมกันได้ไม่เกิน HIS_MAX_CONCURRENT (ค่าเริ่มต้น 2)
 * ไม่ให้รายงานหนักหลายตัวรุมฐาน HIS ที่ใช้งานจริงพร้อมกัน; login / ตัวเลือก dropdown ไม่ผ่านคิวนี้
 */
const MAX_HIS_RUNS = Math.max(1, Number(process.env.HIS_MAX_CONCURRENT) || 2);
const QUEUE_WAIT_MS = 120_000;
declare global {
  var __hisRunQueue: { active: number; waiting: (() => void)[] } | undefined;
}
const q = (global.__hisRunQueue ??= { active: 0, waiting: [] });

async function withHisSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (q.active >= MAX_HIS_RUNS) {
    await new Promise<void>((resolve, reject) => {
      const go = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => {
        q.waiting.splice(q.waiting.indexOf(go), 1);
        reject(new ReportError("มีรายงานอื่นกำลังประมวลผลอยู่หลายรายการ กรุณาลองใหม่อีกครั้ง"));
      }, QUEUE_WAIT_MS);
      q.waiting.push(go);
    });
  } else q.active++;
  try {
    return await fn();
  } finally {
    const next = q.waiting.shift();
    if (next) next(); // ส่งช่องต่อให้คิวถัดไป (active เท่าเดิม)
    else q.active--;
  }
}

/** ชนิดคอลัมน์จาก MySQL protocol (FieldPacket.type) → ใช้เปิดแฟ้มที่บันทึกไว้ได้ถูกชนิดโดยไม่ต้องเดา */
function colType(t: number | undefined): ColType {
  switch (t) {
    case 1: case 2: case 3: case 8: case 9: case 13: case 16: return "int";
    case 0: case 4: case 5: case 246: return "decimal";
    case 10: case 14: return "date";
    case 7: case 12: return "datetime";
    default: return "text";
  }
}

export async function runOnHis(sql: string, args: unknown[], timeoutSec: number, rowLimit: number) {
  assertSelectOnly(sql);
  return withHisSlot(() => execOnHis(sql, args, timeoutSec, rowLimit));
}

async function execOnHis(sql: string, args: unknown[], timeoutSec: number, rowLimit: number) {
  const t0 = Date.now();
  const split = splitSessionVars(sql);
  const body = split.body.trim().replace(/;\s*$/, "");
  const vars = [`max_statement_time=${Math.max(1, Math.floor(timeoutSec))}`, ...split.vars.map(([k, v]) => `${k}=${v}`)];
  let result: [RowDataPacket[], FieldPacket[]];
  try {
    // HIS เป็น MariaDB: จำกัดเวลารัน (และตัวแปรที่อนุญาต) เฉพาะคำสั่งนี้ด้วย SET STATEMENT
    result = await hisDb().query<RowDataPacket[]>(
      { sql: `SET STATEMENT ${vars.join(", ")} FOR ${body}`, timeout: (timeoutSec + 5) * 1000 },
      args);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "ER_STATEMENT_TIMEOUT" || /max_statement_time|timeout/i.test(err.message || "")) {
      throw new ReportError(`รายงานใช้เวลาเกิน ${timeoutSec} วินาที — ลองลดช่วงวันที่`);
    }
    if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT" || err.code === "EHOSTUNREACH") {
      throw new ReportError("เชื่อมต่อฐานข้อมูล HIS ไม่ได้ในขณะนี้");
    }
    throw new ReportError(`SQL ผิดพลาด: ${err.message}`);
  }
  const [data, fields] = result;
  const columns = (fields || []).map((f) => f.name);
  return {
    columns,
    columnTypes: Object.fromEntries((fields || []).map((f) => [f.name, colType(f.type)])),
    rows: data.slice(0, rowLimit).map((r) => ({ ...r })),
    rowCount: data.length,
    truncated: data.length > rowLimit,
    durationMs: Date.now() - t0,
  };
}

type RunInput = {
  reportId: number;
  version: number;
  sql: string;
  params: ParamDef[];
  columns: ColumnDef[];
  values: ParamValues;
  cacheTtl: number;
  timeoutSec: number;
  rowLimit: number;
  canViewPerson: boolean;
  useCache?: boolean;
};

const PENDING_SAVE_SEC = 900;

function resultHash(sql: string, args: unknown[]) {
  return crypto.createHash("sha1").update(JSON.stringify([sql, args])).digest("hex");
}

/**
 * ผลล่าสุดที่เพิ่งประมวลผล (จาก report_cache) สำหรับ "บันทึกผล" — ไม่คิวรี่ HIS ซ้ำ
 * และไม่รับข้อมูลแถวจากเบราว์เซอร์ (กันการแก้ตัวเลขก่อนบันทึก)
 */
export async function pendingResult(i: Omit<RunInput, "cacheTtl" | "timeoutSec" | "rowLimit" | "useCache">): Promise<RunResult | null> {
  const { sql, args } = compileSql(i.sql, i.params, i.values);
  const c = await one<{ payload: string }>(
    "SELECT payload FROM report_cache WHERE report_id=? AND version=? AND params_hash=? AND (expires_at IS NULL OR expires_at > NOW())",
    [i.reportId, i.version, resultHash(sql, args)]);
  if (!c) return null;
  return applyMask(JSON.parse(c.payload), true, i.columns, i.canViewPerson);
}

function applyMask(base: Omit<RunResult, "masked" | "cached">, cached: boolean, columns: ColumnDef[], canViewPerson: boolean): RunResult {
  // ปิดบังข้อมูลส่วนบุคคลทั้งบนจอและใน Excel
  const masked = canViewPerson ? [] : columns.filter((c) => c.person).map((c) => c.name);
  const rows = masked.length
    ? base.rows.map((r) => { const o = { ...r }; for (const m of masked) if (m in o && o[m] !== null && o[m] !== "") o[m] = "••••••"; return o; })
    : base.rows;
  return { ...base, rows, cached, masked };
}

export async function runReport(i: RunInput): Promise<RunResult> {
  const { sql, args } = compileSql(i.sql, i.params, i.values);
  const hash = resultHash(sql, args);

  let base: Omit<RunResult, "masked" | "cached"> | null = null;
  let cached = false;
  if (i.useCache !== false && i.cacheTtl > 0) {
    const c = await one<{ payload: string }>(
      "SELECT payload FROM report_cache WHERE report_id=? AND version=? AND params_hash=? AND (expires_at IS NULL OR expires_at > NOW())",
      [i.reportId, i.version, hash]);
    if (c) { base = JSON.parse(c.payload); cached = true; }
  }
  if (!base) {
    const r = await runOnHis(sql, args, i.timeoutSec, i.rowLimit);
    base = { ...r, generatedAt: new Date().toISOString() };
    // รายงานที่ไม่ใช้ cache (ttl=0) ก็เก็บไว้ 15 นาทีเพื่อรอผู้ใช้กด "บันทึกผล" (ไม่ถูกอ่านเป็น cache เพราะเงื่อนไข cacheTtl > 0 ด้านบน)
    await exec(
      `REPLACE INTO report_cache (report_id, version, params_hash, payload, expires_at)
       VALUES (?,?,?,?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
      [i.reportId, i.version, hash, JSON.stringify(base), i.cacheTtl > 0 ? i.cacheTtl : PENDING_SAVE_SEC]);
  }

  return applyMask(base, cached, i.columns, i.canViewPerson);
}

/** ตัวเลือกของตัวแปรชนิด select_sql (2 คอลัมน์แรก = value, label) */
export async function loadOptions(def: ParamDef) {
  if (def.type === "select") return def.options ?? [];
  if (def.type !== "select_sql" || !def.optionsSql) return [];
  const r = await runOnHis(def.optionsSql, [], 15, 2000);
  const [vc, lc] = [r.columns[0], r.columns[1] ?? r.columns[0]];
  return r.rows.map((row) => ({ value: String(row[vc] ?? ""), label: String(row[lc] ?? "") }));
}

// ---------------------------------------------------------------- validate

/**
 * ตรวจ SQL ก่อนบันทึก: SELECT เท่านั้น, ทุก {ตัวแปร} ต้องกำหนดไว้, และ HIS รับได้จริง (EXPLAIN — ไม่รันคิวรี่)
 * ใช้ค่าเริ่มต้นของตัวแปรแต่ละตัว (ตัวแปรเสริมที่ว่าง → บล็อก [[ ]] ถูกตัด) · คืนข้อความผิดพลาด หรือ null ถ้าผ่าน
 */
export async function validateSqlOnHis(sql: string, params: ParamDef[]): Promise<string | null> {
  try {
    assertSelectOnly(sql);
    const known = new Set(params.map((p) => p.name));
    const missing = tokensInSql(sql).map((t) => t.name).filter((n) => !known.has(n));
    if (missing.length) return `ยังไม่ได้กำหนดตัวแปร: ${missing.map((n) => `{${n}}`).join(", ")} — เพิ่มที่ตัวแก้ไขรายงาน แท็บ “SQL และตัวแปร”`;
    const raw: ParamValues = {};
    for (const p of params) {
      const v = defaultValue(p);
      raw[p.name] = !isEmptyValue(v) || !p.required ? v : p.multiple ? ["0"] : "0";
    }
    const { values } = normalizeValues(params, raw);
    const c = compileSql(sql, params, values);
    const body = splitSessionVars(c.sql).body.trim().replace(/;\s*$/, "");
    await hisDb().query({ sql: `EXPLAIN ${body}`, timeout: 20000 }, c.args);
    return null;
  } catch (e) {
    return String((e as Error).message).slice(0, 300);
  }
}
