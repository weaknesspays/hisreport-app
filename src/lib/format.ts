import type { ColumnDef } from "./report-types";
import { thaiDate } from "./dates";

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function isNumeric(v: unknown) {
  if (typeof v === "number") return Number.isFinite(v);
  return typeof v === "string" && v.trim() !== "" && /^-?\d+(\.\d+)?$/.test(v.trim());
}

/** คอลัมน์ที่เป็นตัวเลขทั้งหมด (ดูจากข้อมูล) */
export function numericColumns(columns: string[], rows: Record<string, unknown>[]) {
  const sample = rows.slice(0, 200);
  return columns.filter((c) => sample.length > 0 && sample.every((r) => r[c] === null || r[c] === "" || isNumeric(r[c])) && sample.some((r) => isNumeric(r[c])));
}

/** รหัสอย่าง HN, an, vn, icd10 ไม่ควรใส่คอมมา */
const CODE_LIKE = /^(hn|an|vn|cid|pid|pop_?id|.*_?id|icd\d*|icd10|code|.*code|ward|cln|pttype|hcode|rfrlct)$/i;

export function formatCell(v: unknown, col?: ColumnDef, colName?: string): string {
  if (v === null || v === undefined) return "";
  const fmt = col?.format;
  if (fmt === "date_th") return thaiDate(String(v));
  if (fmt === "datetime_th") return thaiDate(String(v), true);
  if (fmt === "text") return String(v);
  if (isNumeric(v)) {
    const n = Number(v);
    if (fmt === "decimal2") return nf2.format(n);
    if (fmt === "percent") return `${nf2.format(n)}%`;
    if (fmt === "number") return Number.isInteger(n) ? nf0.format(n) : nf2.format(n);
    const name = col?.name ?? colName ?? "";
    if (CODE_LIKE.test(name)) return String(v);
    return Number.isInteger(n) ? nf0.format(n) : nf2.format(n);
  }
  return String(v);
}

/** สรุปเงื่อนไขเป็นข้อความ เช่น "ช่วงวันที่: 01/10/2568 ถึง 30/09/2569 | คลินิก: 001, 002" */
export function describeValues(values: Record<string, unknown>, labels: Map<string, string>) {
  return Object.entries(values)
    .filter(([, v]) => v !== null && v !== "" && v !== undefined && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => {
      const r = v as { start?: unknown; end?: unknown };
      const text = Array.isArray(v) ? v.join(", ")
        : typeof v === "object" && v && "start" in v ? `${thaiDate(String(r.start))} ถึง ${thaiDate(String(r.end))}`
          : String(v);
      return `${labels.get(k) ?? k}: ${text}`;
    }).join(" | ");
}

export function fmtNumber(n: number | null | undefined, dec = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return dec ? nf2.format(n) : nf0.format(n);
}
