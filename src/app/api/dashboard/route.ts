import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { exec } from "@/lib/db";
import { ensureDashboard } from "@/lib/dashboard";
import { canViewReport, getReport } from "@/lib/reports";

const Body = z.object({
  widgets: z.array(z.object({
    reportId: z.number().int(),
    view: z.enum(["table", "number", "chart"]),
    width: z.enum(["quarter", "half", "full"]),
  })).max(30),
});

/** บันทึกรายการ widget ของ dashboard ผู้ใช้ */
export async function PUT(req: Request) {
  const u = await apiUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const d = await ensureDashboard(u);
  await exec("DELETE FROM dashboard_widget WHERE dashboard_id=?", [d.id]);
  let sort = 0;
  for (const w of parsed.data.widgets) {
    const r = await getReport(w.reportId);
    if (!r || !canViewReport(u, r)) continue;
    await exec("INSERT INTO dashboard_widget (dashboard_id, report_id, view, width, sort) VALUES (?,?,?,?,?)", [d.id, r.id, w.view, w.width, sort++]);
  }
  return NextResponse.json({ ok: true });
}
