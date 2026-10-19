import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { exec, rows } from "@/lib/db";
import { audit } from "@/lib/audit";

const Body = z.object({
  reportIds: z.array(z.number().int().positive()).max(2000),
  scope: z.enum(["me", "all"]).default("me"),   // all = ลำดับกลางสำหรับทุกคน (ผู้ดูแลระบบ)
  resetPersonal: z.boolean().optional(),         // all + true = ล้างลำดับที่ผู้ใช้จัดเองในหัวข้อนี้ ให้ทุกคนเห็นลำดับกลาง
});

type Ctx = { params: Promise<{ id: string }> };

/** บันทึกลำดับกล่องรายงานในหัวข้อ (เขียนทับทั้งชุด) — ของตัวเอง หรือ ลำดับกลาง (ผู้ดูแลระบบ) */
export async function PUT(req: Request, { params }: Ctx) {
  const u = await apiUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const groupId = Number((await params).id);
  if (!u.groupIds.includes(groupId)) return NextResponse.json({ error: "ไม่มีสิทธิ์หัวข้อนี้" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const { scope, resetPersonal } = parsed.data;
  if (scope === "all" && !u.isAdmin) return NextResponse.json({ error: "ลำดับสำหรับทุกคน ตั้งได้เฉพาะผู้ดูแลระบบ" }, { status: 403 });

  // รับเฉพาะรายงานที่อยู่ในหัวข้อนี้จริง
  const valid = new Set((await rows<{ id: number }>("SELECT id FROM report WHERE group_id = ?", [groupId])).map((r) => r.id));
  const ids = [...new Set(parsed.data.reportIds)].filter((id) => valid.has(id));

  if (scope === "all") {
    await exec("DELETE FROM group_report_order WHERE group_id = ?", [groupId]);
    if (ids.length) {
      await exec(`INSERT INTO group_report_order (group_id, report_id, sort, updated_by) VALUES ${ids.map(() => "(?,?,?,?)").join(",")}`,
        ids.flatMap((id, i) => [groupId, id, i, u.id]));
    }
    let cleared = 0;
    if (resetPersonal) {
      cleared = Number((await rows<{ n: number }>("SELECT COUNT(DISTINCT user_id) AS n FROM user_report_order WHERE group_id = ?", [groupId]))[0]?.n ?? 0);
      await exec("DELETE FROM user_report_order WHERE group_id = ?", [groupId]);
    } else {
      await exec("DELETE FROM user_report_order WHERE group_id = ? AND user_id = ?", [groupId, u.id]); // ผู้ดูแลเห็นลำดับกลางที่เพิ่งจัด
    }
    await audit({ userId: u.id, action: "edit_group", detail: `ลำดับรายงานกลาง หัวข้อ #${groupId} (${ids.length} รายงาน)${resetPersonal ? ` · ล้างลำดับส่วนตัว ${cleared} คน` : ""}` });
    return NextResponse.json({ ok: true, saved: ids.length, cleared });
  }

  await exec("DELETE FROM user_report_order WHERE user_id = ? AND group_id = ?", [u.id, groupId]);
  if (ids.length) {
    await exec(`INSERT INTO user_report_order (user_id, group_id, report_id, sort) VALUES ${ids.map(() => "(?,?,?,?)").join(",")}`,
      ids.flatMap((id, i) => [u.id, groupId, id, i]));
  }
  return NextResponse.json({ ok: true, saved: ids.length });
}

/** ?scope=me (ค่าเริ่มต้น) = ล้างลำดับของฉัน (กลับไปใช้ลำดับกลาง) · ?scope=all = ล้างลำดับกลาง (กลับไปเรียงตามชื่อ — ผู้ดูแลระบบ) */
export async function DELETE(req: Request, { params }: Ctx) {
  const u = await apiUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const groupId = Number((await params).id);
  if (new URL(req.url).searchParams.get("scope") === "all") {
    if (!u.isAdmin) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
    await exec("DELETE FROM group_report_order WHERE group_id = ?", [groupId]);
    await audit({ userId: u.id, action: "edit_group", detail: `ล้างลำดับรายงานกลาง หัวข้อ #${groupId}` });
    return NextResponse.json({ ok: true });
  }
  await exec("DELETE FROM user_report_order WHERE user_id = ? AND group_id = ?", [u.id, groupId]);
  return NextResponse.json({ ok: true });
}
