import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { exec, rows } from "@/lib/db";

const Body = z.object({ reportIds: z.array(z.number().int().positive()).max(2000) });

/** บันทึกลำดับกล่องรายงานในหัวข้อของผู้ใช้ (เขียนทับทั้งชุด) */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const groupId = Number((await params).id);
  if (!u.groupIds.includes(groupId)) return NextResponse.json({ error: "ไม่มีสิทธิ์หัวข้อนี้" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  // รับเฉพาะรายงานที่อยู่ในหัวข้อนี้จริง
  const valid = new Set((await rows<{ id: number }>("SELECT id FROM report WHERE group_id = ?", [groupId])).map((r) => r.id));
  const ids = [...new Set(parsed.data.reportIds)].filter((id) => valid.has(id));
  await exec("DELETE FROM user_report_order WHERE user_id = ? AND group_id = ?", [u.id, groupId]);
  if (ids.length) {
    await exec(`INSERT INTO user_report_order (user_id, group_id, report_id, sort) VALUES ${ids.map(() => "(?,?,?,?)").join(",")}`,
      ids.flatMap((id, i) => [u.id, groupId, id, i]));
  }
  return NextResponse.json({ ok: true, saved: ids.length });
}

/** คืนค่าเริ่มต้น (ตามชื่อรายงาน) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  await exec("DELETE FROM user_report_order WHERE user_id = ? AND group_id = ?", [u.id, Number((await params).id)]);
  return NextResponse.json({ ok: true });
}
