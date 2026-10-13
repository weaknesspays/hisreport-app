import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { loadReportForApi } from "@/lib/report-access";
import { normalizeValues } from "@/lib/report-engine";
import { listSaved, saveResult, SavedError, usage } from "@/lib/saved";
import { audit } from "@/lib/audit";
import type { ParamValues } from "@/lib/report-types";

/** รายการแฟ้มของผู้ใช้ (?reportId= กรองเฉพาะรายงาน) */
export async function GET(req: Request) {
  const u = await apiUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const reportId = Number(new URL(req.url).searchParams.get("reportId")) || undefined;
  return NextResponse.json({ items: await listSaved(u.id, reportId), usage: await usage(u.id) });
}

const Body = z.object({
  reportId: z.number().int().positive(),
  values: z.record(z.string(), z.unknown()).optional(),
  name: z.string().trim().min(1, "กรุณาตั้งชื่อแฟ้ม").max(200),
  note: z.string().trim().max(2000).optional().nullable(),
});

/** บันทึกผลล่าสุดของรายงาน + เงื่อนไขนี้ */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const b = parsed.data;

  const r = await loadReportForApi(String(b.reportId));
  if (!r.ok) return r.res;
  const { user, report, version } = r;
  const { values, errors } = normalizeValues(version.params, b.values as ParamValues | undefined);
  if (errors.length) return NextResponse.json({ error: errors.join(" · ") }, { status: 400 });

  try {
    const s = await saveResult(user, report, version, values, b.name, b.note || null);
    await audit({ userId: user.id, action: "save_result", reportId: report.id, params: values, rowCount: s.rowCount, detail: `saved #${s.id}: ${b.name}` });
    return NextResponse.json({ id: s.id });
  } catch (e) {
    if (e instanceof SavedError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}
