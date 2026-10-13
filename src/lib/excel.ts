import "server-only";
import ExcelJS from "exceljs";
import { isNumeric } from "./format";
import type { ColType, ColumnDef } from "./report-types";

/**
 * สร้างไฟล์ Excel ของผลรายงาน 1 ชุด — ใช้ร่วมกันระหว่างรายงานปกติและแฟ้มที่บันทึกไว้
 * หัวกระดาษ: ชื่อรายงาน, เงื่อนไข, ผู้ส่งออก/วันเวลา (+ เวลาของข้อมูลถ้าเป็นแฟ้มที่บันทึกไว้)
 */
export async function buildWorkbook(o: {
  title: string;
  conditions: string;
  exportedBy: string;
  dataNote?: string;
  columns: string[];
  columnTypes?: Record<string, ColType>;
  colDefs: ColumnDef[];
  rows: Record<string, unknown>[];
  masked: string[];
  truncated: boolean;
  rowCount: number;
}) {
  const defs = new Map(o.colDefs.map((c) => [c.name, c]));
  const cols = o.columns.filter((c) => !defs.get(c)?.hidden);
  const wb = new ExcelJS.Workbook();
  wb.creator = o.exportedBy;
  const ws = wb.addWorksheet("รายงาน");

  ws.addRow([`${process.env.HOSPITAL_NAME ?? ""} — ${o.title}`]).font = { bold: true, size: 14 };
  ws.addRow([`เงื่อนไข: ${o.conditions || "-"}`]);
  if (o.dataNote) ws.addRow([o.dataNote]).font = { italic: true };
  ws.addRow([`ส่งออกโดย ${o.exportedBy} เมื่อ ${new Date().toLocaleString("th-TH")}${o.masked.length ? " · ข้อมูลส่วนบุคคลถูกปิดบัง" : ""}`]);
  ws.addRow([]);
  const head = ws.addRow(cols.map((c) => defs.get(c)?.label || c));
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF6" } }; });

  for (const row of o.rows) {
    ws.addRow(cols.map((c) => {
      const v = row[c];
      if (v === null || v === undefined) return "";
      const t = o.columnTypes?.[c];
      const asNumber = t ? t === "int" || t === "decimal" : defs.get(c)?.format !== "text" && isNumeric(v);
      // เลขที่ขึ้นต้นด้วย 0 (HN, รหัส) ต้องคงเป็นข้อความ
      if (asNumber && isNumeric(v) && !/^0\d/.test(String(v))) return Number(v);
      return String(v);
    }));
  }
  if (o.truncated) ws.addRow([`* แสดง ${o.rows.length} จาก ${o.rowCount} แถว (เกินจำนวนแถวสูงสุดของรายงาน)`]);
  cols.forEach((c, i) => { ws.getColumn(i + 1).width = Math.min(45, Math.max(10, (defs.get(c)?.label || c).length + 4)); });
  return wb.xlsx.writeBuffer();
}

export function xlsxResponseHeaders(asciiName: string, displayName: string) {
  const fname = displayName.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
  return {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${asciiName}.xlsx"; filename*=UTF-8''${encodeURIComponent(fname)}.xlsx`,
  };
}
