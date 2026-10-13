import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { exec } from "@/lib/db";

const Body = z.object({
  type: z.enum(["new", "change", "data_issue"]),
  title: z.string().trim().min(1, "กรุณาระบุชื่อรายงาน").max(255),
  detail: z.string().max(5000).optional(),
  urgency: z.enum(["normal", "urgent", "critical"]),
  contact: z.string().max(100).optional(),
  report_id: z.number().int().nullable().optional(),
});

export async function POST(req: Request) {
  const u = await apiUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues.map((i) => i.message).join(" · ") }, { status: 400 });
  const x = p.data;
  await exec("INSERT INTO report_request (user_id, type, title, detail, urgency, contact, report_id) VALUES (?,?,?,?,?,?,?)",
    [u.id, x.type, x.title, x.detail ?? null, x.urgency, x.contact ?? null, x.report_id ?? null]);
  return NextResponse.json({ ok: true });
}

/** ผู้ดูแลเปลี่ยนสถานะคำขอ */
export async function PATCH(req: Request) {
  const u = await apiUser({ admin: true });
  if (!u) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const p = z.object({ id: z.number().int(), status: z.enum(["submitted", "accepted", "developing", "verifying", "published", "rejected"]) })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  await exec("UPDATE report_request SET status=?, assigned_to=COALESCE(assigned_to, ?) WHERE id=?", [p.data.status, u.id, p.data.id]);
  return NextResponse.json({ ok: true });
}
