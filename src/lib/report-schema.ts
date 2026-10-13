import { z } from "zod";

// ตรวจข้อมูลที่ส่งมาจากหน้าแก้ไขรายงาน

export const ParamDefSchema = z.object({
  name: z.string().regex(/^[A-Za-z_]\w*$/, "ชื่อตัวแปรใช้ได้เฉพาะ a-z, 0-9, _"),
  label: z.string().min(1).max(100),
  type: z.enum(["daterange", "date", "fiscal_year", "icd10", "text", "number", "select", "select_sql"]),
  required: z.boolean().optional(),
  multiple: z.boolean().optional(),
  default: z.string().max(200).optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).max(500).optional(),
  optionsSql: z.string().max(5000).optional(),
});

export const ColumnDefSchema = z.object({
  name: z.string().min(1).max(100),
  label: z.string().max(100).optional(),
  format: z.enum(["text", "number", "decimal2", "percent", "date_th", "datetime_th"]).optional(),
  hidden: z.boolean().optional(),
  total: z.enum(["sum", "avg"]).nullable().optional(),
  person: z.boolean().optional(),
});

const View = z.enum(["table", "number", "chart"]);
export const DisplaySchema = z.object({
  views: z.array(View).min(1),
  defaultView: View.optional(),
  number: z.object({ column: z.string().optional(), agg: z.enum(["sum", "count", "first"]).optional(), subColumn: z.string().optional(), subLabel: z.string().optional() }).optional(),
  chart: z.object({ type: z.enum(["bar", "barh", "line"]).optional(), x: z.string().optional(), y: z.array(z.string()).optional(), limit: z.number().int().min(1).max(500).optional() }).optional(),
  table: z.object({ pageSize: z.number().int().min(5).max(500).optional(), totalRow: z.boolean().optional() }).optional(),
  dashboard: z.boolean().optional(),
});

export const ReportSaveSchema = z.object({
  meta: z.object({
    name: z.string().trim().min(1, "กรุณาระบุชื่อรายงาน").max(255),
    group_id: z.number().int().nullable(),
    code: z.string().max(50).nullable().optional(),
    description: z.string().max(5000).nullable().optional(),
    reference: z.string().max(255).nullable().optional(),
    tags: z.string().max(255).nullable().optional(),
    type: z.enum(["system", "custom"]).optional(),
    has_person_data: z.boolean().optional(),
    cache_ttl: z.number().int().min(0).max(31536000).optional(),
    timeout_sec: z.number().int().min(5).max(600).optional(),
    row_limit: z.number().int().min(1).max(500000).optional(),
  }),
  sql: z.string().min(1, "กรุณาใส่คำสั่ง SQL").max(100000),
  params: z.array(ParamDefSchema).max(30),
  columns: z.array(ColumnDefSchema).max(200),
  display: DisplaySchema,
  note: z.string().max(500).optional(),
});

export type ReportSaveInput = z.infer<typeof ReportSaveSchema>;
