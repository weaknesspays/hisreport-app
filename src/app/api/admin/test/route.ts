import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { ParamDefSchema } from "@/lib/report-schema";
import { compileSql, loadOptions, normalizeValues, ReportError, runOnHis } from "@/lib/report-engine";
import type { ParamDef, ParamValues } from "@/lib/report-types";

const Body = z.object({
  sql: z.string().max(100000).optional(),
  params: z.array(ParamDefSchema).max(30),
  values: z.record(z.string(), z.any()).optional(),
  optionsFor: z.string().optional(),
  timeoutSec: z.number().int().min(5).max(600).optional(),
});

/** ทดสอบ SQL ระหว่างแก้ไข (ไม่บันทึก ไม่ cache จำกัด 200 แถว) */
export async function POST(req: Request) {
  const u = await apiUser({ author: true });
  if (!u) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ") }, { status: 400 });
  const { sql, params, values: raw, optionsFor, timeoutSec } = parsed.data;
  const defs = params as ParamDef[];

  try {
    if (optionsFor) {
      const def = defs.find((p) => p.name === optionsFor);
      return NextResponse.json({ options: def ? await loadOptions(def) : [] });
    }
    if (!sql) return NextResponse.json({ error: "กรุณาใส่คำสั่ง SQL" }, { status: 400 });
    const { values, errors } = normalizeValues(defs, raw as ParamValues);
    if (errors.length) return NextResponse.json({ error: errors.join(" · ") }, { status: 400 });
    const compiled = compileSql(sql, defs, values);
    const r = await runOnHis(compiled.sql, compiled.args, timeoutSec ?? 60, 200);
    return NextResponse.json({
      ...r, cached: false, masked: [], generatedAt: new Date().toISOString(),
      compiledSql: compiled.sql, args: compiled.args,
    });
  } catch (e) {
    if (e instanceof ReportError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error(e);
    return NextResponse.json({ error: "ทดสอบไม่สำเร็จ" }, { status: 500 });
  }
}
