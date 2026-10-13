import "server-only";
import { NextResponse } from "next/server";
import { apiUser, type CurrentUser } from "./auth";
import { canViewReport, getReport, viewableVersion, type ReportRow, type ReportVersion } from "./reports";
import { audit } from "./audit";

/** โหลดรายงานสำหรับ API พร้อมตรวจสิทธิ์ — latest=true ใช้เวอร์ชันล่าสุด (ผู้สร้างรายงานเท่านั้น) */
export async function loadReportForApi(idParam: string, latest = false): Promise<
  { ok: true; user: CurrentUser; report: ReportRow; version: ReportVersion } | { ok: false; res: NextResponse }
> {
  const user = await apiUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 }) };
  const report = await getReport(Number(idParam));
  if (!report) return { ok: false, res: NextResponse.json({ error: "ไม่พบรายงาน" }, { status: 404 }) };
  const useLatest = latest && (user.isAdmin || user.canAuthor);
  if (!useLatest && !canViewReport(user, report)) {
    await audit({ userId: user.id, action: "denied", reportId: report.id });
    return { ok: false, res: NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงรายงานนี้" }, { status: 403 }) };
  }
  const version = await viewableVersion(report, useLatest);
  if (!version) return { ok: false, res: NextResponse.json({ error: "รายงานยังไม่ได้เผยแพร่" }, { status: 404 }) };
  return { ok: true, user, report, version };
}
