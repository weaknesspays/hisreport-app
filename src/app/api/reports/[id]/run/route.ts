import { NextResponse } from "next/server";
import { loadReportForApi } from "@/lib/report-access";
import { normalizeValues, runReport, ReportError } from "@/lib/report-engine";
import { audit } from "@/lib/audit";
import { exec } from "@/lib/db";
import type { ParamValues } from "@/lib/report-types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { values?: ParamValues; latest?: boolean; refresh?: boolean; silent?: boolean };
  const r = await loadReportForApi(id, !!body.latest);
  if (!r.ok) return r.res;
  const { user, report, version } = r;

  const { values, errors } = normalizeValues(version.params, body.values);
  if (errors.length) return NextResponse.json({ error: errors.join(" · "), errors }, { status: 400 });

  try {
    const result = await runReport({
      reportId: report.id,
      version: version.version,
      sql: version.sql,
      params: version.params,
      columns: version.columns,
      values,
      cacheTtl: report.cache_ttl,
      timeoutSec: report.timeout_sec,
      rowLimit: report.row_limit,
      canViewPerson: user.canViewPerson,
      useCache: !body.refresh,
    });
    // widget บน dashboard ไม่ต้องบันทึกเป็น "เปิดล่าสุด"
    if (!body.silent) {
      const personShown = report.has_person_data && user.canViewPerson;
      await audit({ userId: user.id, action: personShown ? "view_person" : "view", reportId: report.id, params: values, rowCount: result.rowCount, durationMs: result.durationMs });
      await exec(
        "INSERT INTO user_recent (user_id, report_id, params_json) VALUES (?,?,?) ON DUPLICATE KEY UPDATE params_json=VALUES(params_json), opened_at=NOW()",
        [user.id, report.id, JSON.stringify(values)]);
    }
    return NextResponse.json({ ...result, values });
  } catch (e) {
    if (e instanceof ReportError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error(e);
    return NextResponse.json({ error: "ประมวลผลรายงานไม่สำเร็จ" }, { status: 500 });
  }
}
