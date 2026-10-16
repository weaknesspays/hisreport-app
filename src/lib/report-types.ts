// ชนิดข้อมูลของรายงาน (ใช้ได้ทั้ง server และ client)

export type ParamType =
  | "daterange"   // {name.start} {name.end} {name.end_next}
  | "date"        // {name}
  | "fiscal_year" // {name.start} {name.end} {name.end_next} {name}=ปี พ.ศ.
  | "icd10"
  | "text"
  | "number"
  | "select"      // ตัวเลือกกำหนดเอง
  | "select_sql"; // ตัวเลือกจาก SQL (คืน value, label)

export type ParamDef = {
  name: string;
  label: string;
  type: ParamType;
  required?: boolean;
  multiple?: boolean;
  default?: string;           // ค่าเริ่มต้น เช่น "fy_start", "today", "-30d", "I10"
  options?: { value: string; label: string }[];
  optionsSql?: string;
};

export type ColumnDef = {
  name: string;
  label?: string;
  format?: "text" | "number" | "decimal2" | "percent" | "date_th" | "datetime_th";
  hidden?: boolean;
  total?: "sum" | "avg" | null;
  person?: boolean;           // ข้อมูลส่วนบุคคล → ปิดบังถ้าไม่มีสิทธิ์
};

export type ViewType = "table" | "number" | "chart";

export type DisplayDef = {
  views: ViewType[];
  defaultView?: ViewType;
  number?: { column?: string; agg?: "sum" | "count" | "first"; subColumn?: string; subLabel?: string };
  chart?: { type?: "bar" | "barh" | "line"; x?: string; y?: string[]; y2?: string; limit?: number; labels?: boolean }; // y2 = คอลัมน์บนแกนขวา (หน่วยต่างกัน เช่น บาท), labels = ตัวเลขบนแท่ง/จุด (ไม่ระบุ = อัตโนมัติ)
  table?: { pageSize?: number; totalRow?: boolean };
  dashboard?: boolean;
};

export type ParamValue = string | string[] | { start: string; end: string } | null;
export type ParamValues = Record<string, ParamValue>;

/** ชนิดคอลัมน์จาก HIS (ไม่มีในผลจาก cache เก่า) */
export type ColType = "int" | "decimal" | "date" | "datetime" | "text";

export type RunResult = {
  columns: string[];
  columnTypes?: Record<string, ColType>;
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  durationMs: number;
  cached: boolean;
  generatedAt: string;
  masked: string[];
};

export const PARAM_TYPE_LABEL: Record<ParamType, string> = {
  daterange: "ช่วงวันที่",
  date: "วันที่",
  fiscal_year: "ปีงบประมาณ",
  icd10: "รหัส ICD10",
  text: "ข้อความ",
  number: "ตัวเลข",
  select: "ตัวเลือก (กำหนดเอง)",
  select_sql: "ตัวเลือกจาก SQL",
};

export const VIEW_LABEL: Record<ViewType, string> = { table: "ตาราง", number: "ตัวเลข", chart: "กราฟ" };

export const DEFAULT_DISPLAY: DisplayDef = { views: ["table"], defaultView: "table", table: { pageSize: 50, totalRow: false } };
