import { NextResponse } from "next/server";
import { loadReportForApi } from "@/lib/report-access";
import { normalizeValues, runReport, ReportError } from "@/lib/report-engine";
import { audit } from "@/lib/audit";
import { describeValues } from "@/lib/format";
import { buildWorkbook, xlsxResponseHeaders } from "@/lib/excel";
import type { ParamValues } from "@/lib/report-types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { values?: ParamValues };
  const r = await loadReportForApi(id);
  if (!r.ok) return r.res;
  const { user, report, version } = r;
  if (!user.canExport) return NextResponse.json({ error: "ไม่มีสิทธิ์ส่งออก Excel" }, { status: 403 });

  const { values, errors } = normalizeValues(version.params, body.values);
  if (errors.length) return NextResponse.json({ error: errors.join(" · ") }, { status: 400 });

  try {
    const result = await runReport({
      reportId: report.id, version: version.version, sql: version.sql, params: version.params, columns: version.columns,
      values, cacheTtl: report.cache_ttl, timeoutSec: report.timeout_sec, rowLimit: report.row_limit, canViewPerson: user.canViewPerson,
    });
    const buf = await buildWorkbook({
      title: report.name,
      conditions: describeValues(values, new Map(version.params.map((p) => [p.name, p.label]))),
      exportedBy: `${user.displayName} (${user.username})`,
      columns: result.columns, columnTypes: result.columnTypes, colDefs: version.columns,
      rows: result.rows, masked: result.masked, truncated: result.truncated, rowCount: result.rowCount,
    });
    await audit({ userId: user.id, action: "export", reportId: report.id, params: values, rowCount: result.rowCount, detail: result.masked.length ? "masked" : null });
    return new NextResponse(buf as ArrayBuffer, { headers: xlsxResponseHeaders(`report-${report.id}`, report.name) });
  } catch (e) {
    if (e instanceof ReportError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error(e);
    return NextResponse.json({ error: "ส่งออกไม่สำเร็จ" }, { status: 500 });
  }
}
