import "server-only";
import { exec, one, rows } from "./db";
import type { CurrentUser } from "./auth";
import { DEFAULT_DISPLAY, type ColumnDef, type DisplayDef, type ParamDef } from "./report-types";

export type GroupRow = { id: number; category_id: number | null; category: string | null; name: string; icon: string; description: string | null; sort: number; is_active: number; report_count: number };

export type ReportRow = {
  id: number; group_id: number | null; group_name: string | null; code: string | null; name: string;
  description: string | null; reference: string | null; tags: string | null; type: "system" | "custom";
  status: "draft" | "published" | "disabled"; has_person_data: number; cache_ttl: number; timeout_sec: number;
  row_limit: number; published_version: number | null; latest_version: number; legacy_query_id: number | null; updated_at: string;
};

export type ReportVersion = {
  version: number; sql: string; params: ParamDef[]; columns: ColumnDef[]; display: DisplayDef;
  note: string | null; created_at: string; created_by: string | null;
};

function parseJson<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return fallback; } }
  return v as T;
}

export async function groupsForUser(u: CurrentUser) {
  if (!u.groupIds.length) return [];
  return rows<GroupRow>(
    `SELECT g.*, c.name AS category,
       (SELECT COUNT(*) FROM report r WHERE r.group_id = g.id AND r.status = 'published') AS report_count
     FROM report_group g LEFT JOIN report_category c ON c.id = g.category_id
     WHERE g.is_active = 1 AND g.id IN (${u.groupIds.map(() => "?").join(",")})
     ORDER BY c.sort, g.sort, g.name`, u.groupIds);
}

export async function allGroups() {
  return rows<GroupRow>(
    `SELECT g.*, c.name AS category,
       (SELECT COUNT(*) FROM report r WHERE r.group_id = g.id) AS report_count
     FROM report_group g LEFT JOIN report_category c ON c.id = g.category_id
     ORDER BY c.sort, g.sort, g.name`);
}

const REPORT_SELECT = `SELECT r.*, g.name AS group_name FROM report r LEFT JOIN report_group g ON g.id = r.group_id`;

export async function getReport(id: number) {
  return one<ReportRow>(`${REPORT_SELECT} WHERE r.id = ?`, [id]);
}

export async function listReports(filter: { groupId?: number; status?: string; q?: string; publishedOnly?: boolean; groupIds?: number[] } = {}) {
  const where: string[] = [];
  const args: unknown[] = [];
  if (filter.groupId) { where.push("r.group_id = ?"); args.push(filter.groupId); }
  if (filter.status) { where.push("r.status = ?"); args.push(filter.status); }
  if (filter.publishedOnly) where.push("r.status = 'published'");
  if (filter.groupIds) {
    if (!filter.groupIds.length) return [];
    where.push(`r.group_id IN (${filter.groupIds.map(() => "?").join(",")})`); args.push(...filter.groupIds);
  }
  if (filter.q) {
    where.push("(r.name LIKE ? OR r.description LIKE ? OR r.tags LIKE ? OR r.code LIKE ?)");
    const like = `%${filter.q}%`; args.push(like, like, like, like);
  }
  return rows<ReportRow>(`${REPORT_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY g.sort, r.name`, args);
}

export async function getVersion(reportId: number, version: number): Promise<ReportVersion | null> {
  const v = await one<{ version: number; sql_text: string; params_json: unknown; columns_json: unknown; display_json: unknown; note: string | null; created_at: string; created_by: string | null }>(
    `SELECT v.version, v.sql_text, v.params_json, v.columns_json, v.display_json, v.note, v.created_at, u.username AS created_by
     FROM report_version v LEFT JOIN app_user u ON u.id = v.created_by
     WHERE v.report_id = ? AND v.version = ?`, [reportId, version]);
  if (!v) return null;
  return {
    version: v.version,
    sql: v.sql_text,
    params: parseJson<ParamDef[]>(v.params_json, []),
    columns: parseJson<ColumnDef[]>(v.columns_json, []),
    display: { ...DEFAULT_DISPLAY, ...parseJson<DisplayDef>(v.display_json, DEFAULT_DISPLAY) },
    note: v.note,
    created_at: v.created_at,
    created_by: v.created_by,
  };
}

export async function listVersions(reportId: number) {
  return rows<{ version: number; note: string | null; created_at: string; created_by: string | null }>(
    `SELECT v.version, v.note, v.created_at, u.username AS created_by
     FROM report_version v LEFT JOIN app_user u ON u.id = v.created_by
     WHERE v.report_id = ? ORDER BY v.version DESC`, [reportId]);
}

/** เวอร์ชันที่ผู้ใช้ทั่วไปเห็น (เผยแพร่) — ผู้สร้างรายงานทดสอบเวอร์ชันล่าสุดได้ */
export async function viewableVersion(r: ReportRow, latest = false) {
  const v = latest ? r.latest_version : r.published_version;
  return v ? getVersion(r.id, v) : null;
}

export function canViewReport(u: CurrentUser, r: ReportRow) {
  if (u.isAdmin) return true;
  return r.status === "published" && r.group_id !== null && u.groupIds.includes(r.group_id);
}

export type ReportSave = {
  meta: { name: string; group_id: number | null; code?: string | null; description?: string | null; reference?: string | null; tags?: string | null; type?: "system" | "custom"; has_person_data?: boolean; cache_ttl?: number; timeout_sec?: number; row_limit?: number };
  sql: string; params: ParamDef[]; columns: ColumnDef[]; display: DisplayDef; note?: string;
};

export async function createReport(s: ReportSave, userId: number, legacyQueryId: number | null = null, status: "draft" | "published" | "disabled" = "draft") {
  const m = s.meta;
  const r = await exec(
    `INSERT INTO report (group_id, code, name, description, reference, tags, type, status, has_person_data, cache_ttl, timeout_sec, row_limit, latest_version, published_version, legacy_query_id, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)`,
    [m.group_id, m.code ?? null, m.name, m.description ?? null, m.reference ?? null, m.tags ?? null, m.type ?? "custom", status,
      m.has_person_data ? 1 : 0, m.cache_ttl ?? 1800, m.timeout_sec ?? 60, m.row_limit ?? 50000,
      status === "published" ? 1 : null, legacyQueryId, userId]);
  await insertVersion(r.insertId, 1, s, userId);
  return r.insertId;
}

async function insertVersion(reportId: number, version: number, s: ReportSave, userId: number) {
  await exec(
    `INSERT INTO report_version (report_id, version, sql_text, params_json, columns_json, display_json, note, created_by) VALUES (?,?,?,?,?,?,?,?)`,
    [reportId, version, s.sql, JSON.stringify(s.params), JSON.stringify(s.columns), JSON.stringify(s.display), s.note ?? null, userId]);
}

/** บันทึก: ถ้าเวอร์ชันล่าสุดยังไม่เผยแพร่ ให้เขียนทับร่าง, ถ้าเผยแพร่แล้วสร้างเวอร์ชันใหม่ */
export async function saveReport(id: number, s: ReportSave, userId: number) {
  const r = await getReport(id);
  if (!r) throw new Error("ไม่พบรายงาน");
  const m = s.meta;
  await exec(
    `UPDATE report SET group_id=?, code=?, name=?, description=?, reference=?, tags=?, type=?, has_person_data=?, cache_ttl=?, timeout_sec=?, row_limit=? WHERE id=?`,
    [m.group_id, m.code ?? null, m.name, m.description ?? null, m.reference ?? null, m.tags ?? null, m.type ?? "custom",
      m.has_person_data ? 1 : 0, m.cache_ttl ?? 1800, m.timeout_sec ?? 60, m.row_limit ?? 50000, id]);
  if (r.published_version === r.latest_version) {
    const next = r.latest_version + 1;
    await insertVersion(id, next, s, userId);
    await exec("UPDATE report SET latest_version=? WHERE id=?", [next, id]);
    return next;
  }
  await exec(
    `UPDATE report_version SET sql_text=?, params_json=?, columns_json=?, display_json=?, note=?, created_by=?, created_at=NOW() WHERE report_id=? AND version=?`,
    [s.sql, JSON.stringify(s.params), JSON.stringify(s.columns), JSON.stringify(s.display), s.note ?? null, userId, id, r.latest_version]);
  return r.latest_version;
}

export async function publishReport(id: number, version?: number) {
  const r = await getReport(id);
  if (!r) throw new Error("ไม่พบรายงาน");
  const v = version ?? r.latest_version;
  await exec("UPDATE report SET published_version=?, status='published' WHERE id=?", [v, id]);
  await exec("DELETE FROM report_cache WHERE report_id=?", [id]);
  return v;
}
