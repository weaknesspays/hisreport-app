import "server-only";
import zlib from "node:zlib";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { appDb, one, rows } from "./db";
import type { CurrentUser } from "./auth";
import { getReport, type ReportRow, type ReportVersion } from "./reports";
import { pendingResult } from "./report-engine";
import type { ColType, ColumnDef, DisplayDef, ParamDef, ParamValues, RunResult } from "./report-types";

/**
 * แฟ้มผลรายงาน — ผู้ใช้บันทึกผลที่ประมวลผลแล้วเก็บไว้เปิดดูภายหลังโดยไม่ต้องคิวรี่ HIS ใหม่
 * - เห็นเฉพาะเจ้าของ
 * - เก็บสำเนานิยาม (SQL, ตัวแปร, ค่าเงื่อนไข, รูปแบบคอลัมน์) ณ ตอนบันทึก → รายงานถูกแก้/ลบภายหลังก็ยังเปิดได้
 * - ข้อมูลแถวเก็บแบบไม่ผูกคอลัมน์: gzip ของ {columns:[{name,type}], rows:[[...]]}
 */

export const SAVED_MAX_FILES = Number(process.env.SAVED_MAX_FILES) || 50;
export const SAVED_MAX_BYTES = (Number(process.env.SAVED_MAX_MB) || 200) * 1024 * 1024;

export class SavedError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type SavedMeta = {
  id: number; report_id: number | null; report_version: number; name: string; note: string | null;
  report_name: string; values: ParamValues; params: ParamDef[]; row_count: number; truncated: boolean;
  has_person_data: boolean; masked: string[]; data_bytes: number; generated_at: string; created_at: string; updated_at: string;
  current_version: number | null; // เวอร์ชันที่เผยแพร่อยู่ตอนนี้ (null = รายงานถูกลบ)
};

type Payload = { columns: { name: string; type?: ColType }[]; rows: unknown[][] };

const json = <T>(v: unknown, fallback: T): T => (v === null || v === undefined ? fallback : typeof v === "string" ? JSON.parse(v) as T : v as T);

const META_SELECT = `
  SELECT s.id, s.report_id, s.report_version, s.name, s.note, s.report_name, s.values_json, s.params_json, s.row_count, s.truncated,
         s.has_person_data, s.masked_json, s.data_bytes, s.generated_at, s.created_at, s.updated_at, r.published_version AS current_version
  FROM saved_result s LEFT JOIN report r ON r.id = s.report_id`;

type MetaRow = Omit<SavedMeta, "values" | "params" | "masked" | "truncated" | "has_person_data"> & {
  values_json: unknown; params_json: unknown; masked_json: unknown; truncated: number; has_person_data: number;
};

function toMeta(r: MetaRow): SavedMeta {
  const { values_json, params_json, masked_json, ...rest } = r;
  return {
    ...rest, truncated: !!r.truncated, has_person_data: !!r.has_person_data,
    values: json(values_json, {}), params: json(params_json, []), masked: json(masked_json, []),
  };
}

export async function usage(userId: number) {
  const u = await one<{ n: number; bytes: number | null }>("SELECT COUNT(*) AS n, SUM(data_bytes) AS bytes FROM saved_result WHERE user_id=?", [userId]);
  return { files: Number(u?.n ?? 0), bytes: Number(u?.bytes ?? 0), maxFiles: SAVED_MAX_FILES, maxBytes: SAVED_MAX_BYTES };
}

/** บันทึกผลล่าสุดที่ผู้ใช้เพิ่งประมวลผล (จาก cache ฝั่ง server — ไม่รับข้อมูลแถวจากเบราว์เซอร์) */
export async function saveResult(user: CurrentUser, report: ReportRow, version: ReportVersion, values: ParamValues, name: string, note: string | null) {
  const result = await pendingResult({
    reportId: report.id, version: version.version, sql: version.sql, params: version.params, columns: version.columns,
    values, canViewPerson: user.canViewPerson,
  });
  if (!result) throw new SavedError("ผลการประมวลผลหมดอายุแล้ว กรุณากด “ประมวลผล” อีกครั้งก่อนบันทึก", 409);

  const payload: Payload = {
    columns: result.columns.map((c) => ({ name: c, type: result.columnTypes?.[c] })),
    rows: result.rows.map((r) => result.columns.map((c) => r[c] ?? null)),
  };
  const blob = zlib.gzipSync(JSON.stringify(payload));

  const u = await usage(user.id);
  if (u.files >= SAVED_MAX_FILES) throw new SavedError(`บันทึกได้สูงสุด ${SAVED_MAX_FILES} แฟ้ม — กรุณาลบแฟ้มเก่าก่อน`, 413);
  if (u.bytes + blob.length > SAVED_MAX_BYTES) throw new SavedError(`พื้นที่เก็บแฟ้มเต็ม (${Math.round(SAVED_MAX_BYTES / 1048576)} MB) — กรุณาลบแฟ้มเก่าก่อน`, 413);

  const conn: PoolConnection = await appDb().getConnection();
  try {
    await conn.beginTransaction();
    const [ins] = await conn.query<ResultSetHeader>(
      `INSERT INTO saved_result (user_id, report_id, report_version, name, note, report_name, sql_text, params_json, values_json,
         columns_json, display_json, row_count, truncated, masked_json, has_person_data, data_bytes, generated_at, duration_ms)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [user.id, report.id, version.version, name, note, report.name, version.sql, JSON.stringify(version.params), JSON.stringify(values),
        JSON.stringify(version.columns), JSON.stringify(version.display), result.rowCount, +result.truncated, JSON.stringify(result.masked),
        +!!report.has_person_data, blob.length, toSqlDate(result.generatedAt), result.durationMs ?? null]);
    await conn.query("INSERT INTO saved_result_data (saved_id, payload) VALUES (?,?)", [ins.insertId, blob]);
    await conn.commit();
    return { id: ins.insertId, rowCount: result.rowCount };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

function toSqlDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export async function listSaved(userId: number, reportId?: number) {
  const list = await rows<MetaRow>(
    `${META_SELECT} WHERE s.user_id = ? ${reportId ? "AND s.report_id = ?" : ""} ORDER BY s.created_at DESC`,
    reportId ? [userId, reportId] : [userId]);
  return list.map(toMeta);
}

/** สิทธิ์เปิดแฟ้ม: ต้องเป็นเจ้าของ และถ้ารายงานต้นทางยังอยู่ ต้องยังมีสิทธิ์หัวข้อรายงานนั้น */
async function ownedMeta(user: CurrentUser, id: number) {
  const r = await one<MetaRow & { user_id: number }>(`${META_SELECT.replace("SELECT s.id", "SELECT s.user_id, s.id")} WHERE s.id = ?`, [id]);
  if (!r || r.user_id !== user.id) throw new SavedError("ไม่พบแฟ้มนี้", 404);
  return r;
}

function stillAllowed(user: CurrentUser, report: ReportRow | null) {
  if (!report || user.isAdmin) return true;
  return report.group_id !== null && user.groupIds.includes(report.group_id);
}

export type SavedFull = SavedMeta & { columns: ColumnDef[]; display: DisplayDef; sql: string; result: RunResult; reportExists: boolean };

export async function loadSaved(user: CurrentUser, id: number): Promise<SavedFull> {
  const m = await ownedMeta(user, id);
  const report = m.report_id ? await getReport(m.report_id) : null;
  if (!stillAllowed(user, report)) throw new SavedError("คุณไม่มีสิทธิ์เข้าถึงรายงานต้นทางของแฟ้มนี้แล้ว", 403);

  const extra = await one<{ sql_text: string; columns_json: unknown; display_json: unknown }>(
    "SELECT sql_text, columns_json, display_json FROM saved_result WHERE id=?", [id]);
  const data = await one<{ payload: Buffer }>("SELECT payload FROM saved_result_data WHERE saved_id=?", [id]);
  if (!extra || !data) throw new SavedError("ข้อมูลแฟ้มเสียหาย", 500);

  const meta = toMeta(m);
  const columns = json<ColumnDef[]>(extra.columns_json, []);
  const p = JSON.parse(zlib.gunzipSync(data.payload).toString("utf8")) as Payload;
  const names = p.columns.map((c) => c.name);
  let rowsOut = p.rows.map((r) => Object.fromEntries(names.map((n, i) => [n, r[i]])));

  // ผู้ใช้ถูกถอดสิทธิ์ดูข้อมูลบุคคลหลังบันทึก → ปิดบังตอนเปิด
  const masked = new Set(meta.masked);
  if (!user.canViewPerson) {
    const person = columns.filter((c) => c.person && !masked.has(c.name)).map((c) => c.name);
    if (person.length) {
      rowsOut = rowsOut.map((r) => { const o = { ...r }; for (const c of person) if (o[c] !== null && o[c] !== "") o[c] = "••••••"; return o; });
      person.forEach((c) => masked.add(c));
    }
  }

  return {
    ...meta, columns, sql: extra.sql_text, reportExists: !!report,
    display: json<DisplayDef>(extra.display_json, { views: ["table"] }),
    result: {
      columns: names,
      columnTypes: Object.fromEntries(p.columns.filter((c) => c.type).map((c) => [c.name, c.type!])),
      rows: rowsOut, rowCount: meta.row_count, truncated: meta.truncated, durationMs: 0, cached: true,
      generatedAt: new Date(meta.generated_at.replace(" ", "T")).toISOString(), masked: [...masked],
    },
  };
}

export async function updateSaved(user: CurrentUser, id: number, patch: { name?: string; note?: string | null }) {
  await ownedMeta(user, id);
  const sets: string[] = [], args: unknown[] = [];
  if (patch.name !== undefined) { sets.push("name=?"); args.push(patch.name); }
  if (patch.note !== undefined) { sets.push("note=?"); args.push(patch.note); }
  if (!sets.length) return;
  await appDb().query(`UPDATE saved_result SET ${sets.join(", ")} WHERE id=? AND user_id=?`, [...args, id, user.id]);
}

/** ลบได้เฉพาะแฟ้มของตัวเอง — ข้อมูลใน saved_result_data ลบตาม (ON DELETE CASCADE) */
export async function deleteSaved(user: CurrentUser, ids: number[]) {
  if (!ids.length) return [];
  const own = await rows<{ id: number; name: string; report_id: number | null }>(
    `SELECT id, name, report_id FROM saved_result WHERE user_id=? AND id IN (${ids.map(() => "?").join(",")})`, [user.id, ...ids]);
  if (own.length) await appDb().query(`DELETE FROM saved_result WHERE user_id=? AND id IN (${own.map(() => "?").join(",")})`, [user.id, ...own.map((o) => o.id)]);
  return own;
}
