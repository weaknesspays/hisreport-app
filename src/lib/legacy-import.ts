import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { hisDb, exec, one, rows } from "./db";
import { createReport } from "./reports";
import { DEFAULT_DISPLAY, type ParamDef, type ParamValues } from "./report-types";
import { assertSelectOnly, compileSql, normalizeValues, splitSessionVars } from "./report-engine";

/** ตำแหน่งเครื่องหมาย ? ที่อยู่นอก string / comment */
function placeholderPositions(sql: string) {
  const pos: number[] = [];
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], n = sql[i + 1];
    if (c === "'" || c === '"' || c === "`") {
      const q = c;
      for (i++; i < sql.length; i++) {
        if (sql[i] === "\\") { i++; continue; }
        if (sql[i] === q) { if (sql[i + 1] === q) { i++; continue; } break; }
      }
    } else if ((c === "-" && n === "-") || c === "#") {
      while (i < sql.length && sql[i] !== "\n") i++;
    } else if (c === "/" && n === "*") {
      i += 2; while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++; i++;
    } else if (c === "?") pos.push(i);
  }
  return pos;
}

/**
 * แปลงคิวรี่เดิม (ใช้ ?) เป็นตัวแปรแบบมีชื่อ
 * datestart → {date.start}, dateend → {date.end} (วันสุดท้ายแบบรวมวันนั้น ตรงกับ BETWEEN เดิม)
 */
export function convertLegacySql(sql: string, paramsCsv: string | null) {
  const names = (paramsCsv || "").split(",").map((s) => s.trim()).filter(Boolean);
  const pos = placeholderPositions(sql);
  const notes: string[] = [];
  if (pos.length && !names.length) notes.push(`พบ ? ${pos.length} ตัวแต่ไม่มีรายชื่อตัวแปร`);
  if (names.length && pos.length % names.length !== 0) notes.push(`จำนวน ? (${pos.length}) ไม่ลงตัวกับตัวแปร (${names.join(",")})`);

  let out = "";
  let last = 0;
  pos.forEach((p, i) => {
    const name = names.length ? names[i % names.length] : `p${i + 1}`;
    const token = name === "datestart" ? "{date.start}" : name === "dateend" ? "{date.end}" : `{${name}}`;
    out += sql.slice(last, p) + token;
    last = p + 1;
  });
  out += sql.slice(last);

  const params: ParamDef[] = [];
  const used = new Set(pos.map((_, i) => (names.length ? names[i % names.length] : `p${i + 1}`)));
  if (used.has("datestart") || used.has("dateend")) {
    params.push({ name: "date", label: "ช่วงวันที่", type: "daterange", required: true, default: "fy_start,today" });
  }
  for (const n of used) {
    if (n === "datestart" || n === "dateend") continue;
    params.push({ name: n, label: n, type: "text", required: true });
  }
  return { sql: out.trim(), params, notes };
}

/** หาชื่อกลุ่มเดิมจากตารางใน schema เดียวกันที่มีคอลัมน์ item_id (ถ้ามี) */
async function legacyGroupNames(schema: string) {
  const names = new Map<number, string>();
  try {
    const [cands] = await hisDb().query<RowDataPacket[]>(
      `SELECT c.TABLE_NAME AS t,
         (SELECT c2.COLUMN_NAME FROM information_schema.COLUMNS c2
           WHERE c2.TABLE_SCHEMA = c.TABLE_SCHEMA AND c2.TABLE_NAME = c.TABLE_NAME
             AND c2.COLUMN_NAME IN ('item_name','name','title','item_title','menu_name')
           ORDER BY FIELD(c2.COLUMN_NAME,'item_name','name','title','item_title','menu_name') LIMIT 1) AS n
       FROM information_schema.COLUMNS c
       WHERE c.TABLE_SCHEMA = ? AND c.COLUMN_NAME = 'item_id' AND c.TABLE_NAME <> 'rep_query_item'`, [schema]);
    const pick = cands.find((r) => r.n);
    if (pick) {
      const [list] = await hisDb().query<RowDataPacket[]>(
        `SELECT item_id, \`${String(pick.n).replace(/`/g, "")}\` AS name FROM \`${schema}\`.\`${String(pick.t).replace(/`/g, "")}\``);
      for (const r of list) if (r.name) names.set(Number(r.item_id), String(r.name));
    }
  } catch {
    // ไม่มีตารางชื่อกลุ่ม → ใช้ชื่อชั่วคราว
  }
  return names;
}

/** ตรวจว่า SQL ใช้ได้กับฐาน HIS จริงด้วย EXPLAIN (ไม่รันคิวรี่) คืนข้อความผิดพลาด หรือ null ถ้าผ่าน */
async function explainOnHis(sql: string, params: ParamDef[]) {
  try {
    assertSelectOnly(sql);
    const raw: ParamValues = {};
    for (const p of params) raw[p.name] = p.type === "daterange" ? { start: "2026-10-01", end: "2026-10-01" } : "0";
    const { values } = normalizeValues(params, raw);
    const c = compileSql(sql, params, values);
    const body = splitSessionVars(c.sql).body.trim().replace(/;\s*$/, "");
    await hisDb().query({ sql: `EXPLAIN ${body}`, timeout: 20000 }, c.args);
    return null;
  } catch (e) {
    return String((e as Error).message).slice(0, 200);
  }
}

export type LegacyRow ={ query_id: number; item_id: number; query_name: string | null; query_sql: string | null; query_params: string | null; comment: string | null; level_id: string };

export async function previewLegacy() {
  const schema = process.env.HIS_LEGACY_SCHEMA || "reportdb";
  const [list] = await hisDb().query<RowDataPacket[]>(
    `SELECT query_id, item_id, query_name, query_params, level_id FROM \`${schema}\`.rep_query_item ORDER BY query_id`);
  const imported = await rows<{ legacy_query_id: number }>("SELECT legacy_query_id FROM report WHERE legacy_query_id IS NOT NULL");
  const done = new Set(imported.map((r) => r.legacy_query_id));
  return list.map((r) => ({ ...r, imported: done.has(Number(r.query_id)) }));
}

/** นำเข้าทั้งหมด (ข้ามรายการที่นำเข้าแล้ว) — อ่านจาก HIS อย่างเดียว */
export async function importLegacy(userId: number, status: "draft" | "published") {
  const schema = process.env.HIS_LEGACY_SCHEMA || "reportdb";
  const [list] = await hisDb().query<RowDataPacket[]>(
    `SELECT query_id, item_id, query_name, query_sql, query_params, comment, level_id FROM \`${schema}\`.rep_query_item ORDER BY query_id`);
  const groupNames = await legacyGroupNames(schema);

  let cat = await one<{ id: number }>("SELECT id FROM report_category WHERE name = 'นำเข้าจากระบบเดิม'");
  if (!cat) {
    const r = await exec("INSERT INTO report_category (name, sort) VALUES ('นำเข้าจากระบบเดิม', 90)");
    cat = { id: r.insertId };
  }

  const groupId = new Map<number, number>();
  for (const g of await rows<{ id: number; legacy_item_id: number }>("SELECT id, legacy_item_id FROM report_group WHERE legacy_item_id IS NOT NULL")) {
    groupId.set(g.legacy_item_id, g.id);
  }

  const result = { imported: 0, skipped: 0, disabled: 0, warnings: [] as string[] };
  for (const raw of list as unknown as LegacyRow[]) {
    const exists = await one("SELECT id FROM report WHERE legacy_query_id = ?", [raw.query_id]);
    if (exists) { result.skipped++; continue; }

    const item = Number(raw.item_id);
    if (!groupId.has(item)) {
      const name = groupNames.get(item) ?? `กลุ่มเดิม #${item}`;
      const g = await exec("INSERT INTO report_group (category_id, name, icon, sort, legacy_item_id) VALUES (?,?,?,?,?)",
        [cat.id, name, "folder", 100 + item, item]);
      groupId.set(item, g.insertId);
    }

    const conv = convertLegacySql(raw.query_sql || "", raw.query_params);
    const sqlError = await explainOnHis(conv.sql, conv.params);
    if (sqlError) conv.notes.push(`SQL ใช้ไม่ได้กับฐานปัจจุบัน: ${sqlError}`);
    const name = (raw.query_name || `คิวรี่ #${raw.query_id}`).replace(/\s+/g, " ").trim();
    // level 4 ในระบบเดิมเป็นรายการที่เลิกใช้ (ชื่อมี Noooooooo)
    const st = raw.level_id === "4" ? "disabled" : status;
    const note = [`นำเข้าจาก rep_query_item #${raw.query_id} (level ${raw.level_id})`, ...conv.notes].join(" · ");
    await createReport({
      meta: {
        name: name.slice(0, 255),
        group_id: groupId.get(item)!,
        description: raw.comment || null,
        reference: `rep_query_item #${raw.query_id}`,
        type: "system",
        cache_ttl: 1800,
      },
      sql: conv.sql,
      params: conv.params,
      columns: [],
      display: DEFAULT_DISPLAY,
      note,
    }, userId, Number(raw.query_id), conv.notes.length ? "draft" : st);
    result.imported++;
    if (st === "disabled") result.disabled++;
    if (conv.notes.length) result.warnings.push(`#${raw.query_id} ${name}: ${conv.notes.join(", ")} (นำเข้าเป็นร่าง)`);
  }
  return result;
}
