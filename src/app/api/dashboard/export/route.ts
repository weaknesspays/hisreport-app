import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { apiUser } from "@/lib/auth";
import { dashboardWidgets, ensureDashboard } from "@/lib/dashboard";
import { getReport, getVersion } from "@/lib/reports";
import { normalizeValues, runReport, ReportError } from "@/lib/report-engine";
import { audit } from "@/lib/audit";
import { isNumeric } from "@/lib/format";
import type { ParamValues } from "@/lib/report-types";

/** ส่งออกทุกรายงานบน dashboard: 1 รายงาน = 1 sheet + sheet สรุป */
export async function POST(req: Request) {
  const u = await apiUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!u.canExport) return NextResponse.json({ error: "ไม่มีสิทธิ์ส่งออก Excel" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { values?: Record<string, ParamValues> };

  const d = await ensureDashboard(u);
  const widgets = await dashboardWidgets(u, d.id);
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet("สรุป");
  summary.addRow([`${process.env.HOSPITAL_NAME ?? ""} — ${d.name}`]).font = { bold: true, size: 14 };
  summary.addRow([`ส่งออกโดย ${u.displayName} (${u.username}) เมื่อ ${new Date().toLocaleString("th-TH")}`]);
  summary.addRow([]);
  summary.addRow(["ลำดับ", "รายงาน", "sheet", "จำนวนแถว", "หมายเหตุ"]).font = { bold: true };

  const usedNames = new Set<string>(["สรุป"]);
  let i = 0;
  let totalRows = 0;
  for (const w of widgets) {
    i++;
    const report = await getReport(w.reportId);
    const v = report?.published_version ? await getVersion(report.id, report.published_version) : null;
    if (!report || !v) continue;
    const { values, errors } = normalizeValues(v.params, body.values?.[String(w.id)]);
    if (errors.length) { summary.addRow([i, w.name, "-", "", errors.join(", ")]); continue; }

    let sheetName = `${i}. ${w.name}`.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
    while (usedNames.has(sheetName)) sheetName = `${sheetName.slice(0, 27)}_${i}`;
    usedNames.add(sheetName);
    try {
      const res = await runReport({
        reportId: report.id, version: v.version, sql: v.sql, params: v.params, columns: v.columns, values,
        cacheTtl: report.cache_ttl, timeoutSec: report.timeout_sec, rowLimit: report.row_limit, canViewPerson: u.canViewPerson,
      });
      const defs = new Map(v.columns.map((c) => [c.name, c]));
      const cols = res.columns.filter((c) => !defs.get(c)?.hidden);
      const ws = wb.addWorksheet(sheetName);
      ws.addRow([w.name]).font = { bold: true };
      ws.addRow([]);
      ws.addRow(cols.map((c) => defs.get(c)?.label || c)).font = { bold: true };
      for (const row of res.rows) {
        // ชนิดจาก HIS มาก่อน (ข้อความที่เป็นเลขล้วน เช่น DATE_FORMAT → คงเป็นข้อความ) · ไม่มีชนิด → ดูจากค่า
        ws.addRow(cols.map((c) => {
          const t = res.columnTypes?.[c];
          const asNumber = t ? t === "int" || t === "decimal" : defs.get(c)?.format !== "text";
          return asNumber && isNumeric(row[c]) && !/^0\d/.test(String(row[c])) ? Number(row[c]) : row[c] ?? "";
        }));
      }
      totalRows += res.rows.length;
      summary.addRow([i, w.name, sheetName, res.rowCount, res.masked.length ? "ข้อมูลส่วนบุคคลถูกปิดบัง" : ""]);
    } catch (e) {
      summary.addRow([i, w.name, "-", "", e instanceof ReportError ? e.message : "ผิดพลาด"]);
    }
  }
  summary.getColumn(2).width = 50;
  if (!totalRows) return NextResponse.json({ error: "ไม่มีข้อมูลให้ส่งออก" }, { status: 422 });
  await audit({ userId: u.id, action: "export", detail: `dashboard ${d.id} (${widgets.length} รายงาน)` });
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dashboard.xlsx"`,
    },
  });
}
