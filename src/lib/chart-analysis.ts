import { isNumeric } from "./format";
import type { ColumnDef, RunResult } from "./report-types";

/**
 * วิเคราะห์ผลลัพธ์รายงานก่อนทำกราฟ — แยกชนิดคอลัมน์จากชื่อ + ข้อมูลจริง
 *
 * - id       : รหัสประจำตัว/ค่าที่แทบไม่ซ้ำ (HN, AN, เลขบัตร, ชื่อ-สกุล, ที่อยู่) → ห้ามนำมาบวก/ทำแกน
 * - date     : วันที่ (YYYY-MM-DD…) → จัดกลุ่มรายวัน/รายเดือน
 * - category : ค่าที่ซ้ำกันได้ (เพศ, ตำบล, ICD10, หมู่) → ใช้จัดกลุ่ม
 * - measure  : ปริมาณที่บวก/เฉลี่ยได้ (จำนวน, วันนอน, adjrw)
 *
 * แล้วตัดสินว่าผลลัพธ์เป็น
 * - summary : สรุปมาแล้ว (1 แถว = 1 หมวด + คอลัมน์ตัวเลข) → กราฟตรง ๆ
 * - detail  : รายการรายบุคคล/รายครั้ง (1 แถว = 1 ราย) → ต้องนับ/รวมแยกตามคอลัมน์ก่อน
 */

export type ColKind = "id" | "date" | "category" | "measure";
export type ColInfo = { name: string; label: string; kind: ColKind; distinct: number };
export type Analysis = {
  mode: "summary" | "detail";
  cols: ColInfo[];
  measures: ColInfo[];
  dims: ColInfo[];        // คอลัมน์ที่ใช้จัดกลุ่มได้ (detail)
  ids: ColInfo[];
  x?: ColInfo;            // แกนหมวด (summary)
};

const ID_NAME = /^(hn|an|vn|cid|pid|pop_?id|id|.*_id|idcard|cardid|person_?id|tel|phone|mobile|telephone|zip|postcode|address|addr|fullname|name|fname|lname|ptname|ชื่อ|ชื่อ-?สกุล|ชื่อ-ชื่อสกุล|ชื่อ-นามสกุล|ชื่อผู้ป่วย|เลขบัตร.*|บัตรประชาชน|เบอร์.*|โทร.*|ที่อยู่|บ้านเลขที่)$/i;
const CAT_NAME = /(moo|หมู่|code|รหัส|icd|^ปี|year|month|เดือน|sex|เพศ|ward|cln|pttype|ตึก|คลินิก|สิทธิ)/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function median(nums: number[]) {
  const s = [...nums].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

export function analyzeResult(result: RunResult, defs: Map<string, ColumnDef>): Analysis {
  const rows = result.rows.slice(0, 5000);
  const cols: ColInfo[] = result.columns
    .filter((c) => !defs.get(c)?.hidden)
    .map((name) => {
      const def = defs.get(name);
      const label = def?.label || name;
      const vals = rows.map((r) => r[name]).filter((v) => v !== null && v !== undefined && v !== "");
      const distinct = new Set(vals.map(String)).size;
      const unique = vals.length >= 5 && distinct / vals.length >= 0.9;
      let kind: ColKind;
      if (def?.person || ID_NAME.test(name) || ID_NAME.test(label)) kind = "id";
      else if (vals.length && vals.every((v) => DATE_RE.test(String(v)))) kind = "date";
      else if (vals.length && vals.every(isNumeric)) {
        const nums = vals.map(Number);
        if (CAT_NAME.test(name) || CAT_NAME.test(label)) kind = "category";
        else if (unique && nums.every(Number.isInteger) && median(nums) >= 1000) kind = "id"; // เลขลำดับ/รหัสยาว ๆ
        else kind = "measure";
      } else kind = unique && vals.length > 15 && !CAT_NAME.test(name) && !CAT_NAME.test(label) ? "id" : "category";
      return { name, label, kind, distinct };
    });

  const n = result.rows.length;
  const measures = cols.filter((c) => c.kind === "measure");
  const ids = cols.filter((c) => c.kind === "id");
  const hardId = ids.some((c) => ID_NAME.test(c.name) || ID_NAME.test(c.label) || defs.get(c.name)?.person);
  // summary: ไม่มีรหัสบุคคล, มีตัวเลข, และมีคอลัมน์หมวดที่ไม่ซ้ำกันเลย (1 แถว = 1 หมวด)
  const x = cols.find((c) => c.kind !== "measure" && c.distinct === n);
  const summary = !hardId && measures.length > 0 && n <= 500 && (n === 1 || !!x);

  const dims = cols
    .filter((c) => c.kind === "date" ? c.distinct >= 1 : c.kind === "category" && c.distinct >= 1 && c.distinct <= 50)
    // เรียง: หมวดข้อความ 2–15 ค่า ก่อน → วันที่ → ที่เหลือ
    .sort((a, b) => rank(a) - rank(b));

  return { mode: summary ? "summary" : "detail", cols, measures, dims, ids, x };
}

function rank(c: ColInfo) {
  if (c.kind === "category" && c.distinct >= 2 && c.distinct <= 15) return 0;
  if (c.kind === "date") return 1;
  if (c.kind === "category" && c.distinct >= 2) return 2;
  return 3;
}

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export type Metric = "count" | `sum:${string}` | `avg:${string}`;
export type Point = { __x: string; value: number };

/** "sum:วันนอน" → ["sum", "วันนอน"] (ชื่อคอลัมน์อาจมี ":" ได้) */
function splitMetric(metric: Metric): [string, string] {
  const i = metric.indexOf(":");
  return i < 0 ? [metric, ""] : [metric.slice(0, i), metric.slice(i + 1)];
}

/** จัดกลุ่มข้อมูลรายการ → จุดสำหรับกราฟ */
export function groupRows(rows: Record<string, unknown>[], dim: ColInfo, metric: Metric, top = 15): { data: Point[]; unit?: "day" | "month"; others: number } {
  const [how, col] = splitMetric(metric);
  let unit: "day" | "month" | undefined;
  let keyOf = (r: Record<string, unknown>) => String(r[dim.name] ?? "(ว่าง)");

  if (dim.kind === "date") {
    const ds = rows.map((r) => String(r[dim.name] ?? "").slice(0, 10)).filter(Boolean).sort();
    const span = ds.length ? (Date.parse(ds[ds.length - 1]) - Date.parse(ds[0])) / 864e5 : 0;
    unit = span > 62 ? "month" : "day";
    keyOf = (r) => String(r[dim.name] ?? "").slice(0, unit === "month" ? 7 : 10) || "(ว่าง)";
  }

  const acc = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const k = keyOf(r);
    const a = acc.get(k) ?? { sum: 0, n: 0 };
    if (how === "count") { a.sum += 1; a.n += 1; }
    else if (isNumeric(r[col])) { a.sum += Number(r[col]); a.n += 1; }
    acc.set(k, a);
  }
  let data = [...acc.entries()].map(([k, a]) => ({ k, value: how === "avg" ? (a.n ? a.sum / a.n : 0) : a.sum }));

  if (dim.kind === "date") {
    data.sort((a, b) => a.k.localeCompare(b.k));
    return {
      unit, others: 0,
      data: data.map(({ k, value }) => {
        const [y, m, d] = k.split("-").map(Number);
        const label = !m ? k : unit === "month" ? `${TH_MONTH[m - 1]} ${String((y + 543) % 100).padStart(2, "0")}` : `${d} ${TH_MONTH[m - 1]}`;
        return { __x: label, value };
      }),
    };
  }

  data.sort((a, b) => b.value - a.value);
  let others = 0;
  if (data.length > top) {
    const rest = data.slice(top);
    others = rest.length;
    const v = how === "avg" ? rest.reduce((s, x) => s + x.value, 0) / rest.length : rest.reduce((s, x) => s + x.value, 0);
    data = [...data.slice(0, top), { k: `อื่น ๆ (${rest.length})`, value: v }];
  }
  return { data: data.map(({ k, value }) => ({ __x: k, value })), others };
}

export function metricLabel(metric: Metric, cols: ColInfo[]) {
  if (metric === "count") return "จำนวน (แถว)";
  const [how, col] = splitMetric(metric);
  const label = cols.find((c) => c.name === col)?.label ?? col;
  return `${how === "sum" ? "ผลรวม" : "ค่าเฉลี่ย"} ${label}`;
}
