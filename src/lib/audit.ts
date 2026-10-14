import "server-only";
import { headers } from "next/headers";
import { exec } from "./db";

export type AuditAction =
  | "login" | "login_fail" | "logout"
  | "view" | "view_person" | "export"
  | "edit_report" | "publish_report" | "import_legacy"
  | "edit_permission" | "edit_user" | "edit_group" | "edit_setting"
  | "save_result" | "view_saved" | "export_saved" | "delete_saved"
  | "denied";

export async function audit(a: {
  userId: number | null;
  action: AuditAction;
  reportId?: number | null;
  params?: unknown;
  rowCount?: number | null;
  durationMs?: number | null;
  detail?: string | null;
}) {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null;
    await exec(
      "INSERT INTO audit_log (user_id, action, report_id, params_json, row_count, duration_ms, detail, ip) VALUES (?,?,?,?,?,?,?,?)",
      [a.userId, a.action, a.reportId ?? null, a.params === undefined ? null : JSON.stringify(a.params),
        a.rowCount ?? null, a.durationMs ?? null, a.detail?.slice(0, 500) ?? null, ip],
    );
  } catch (e) {
    // log ล้มเหลวต้องไม่ทำให้รายงานล้ม
    console.error("audit failed", e);
  }
}
