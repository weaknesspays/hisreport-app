import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { exec, one } from "@/lib/db";
import { audit } from "@/lib/audit";

const Role = z.object({
  id: z.number().int().optional(),
  name: z.string().trim().min(1).max(100),
  can_export: z.boolean(),
  can_view_person: z.boolean(),
  can_author: z.boolean(),
  is_admin: z.boolean(),
  groupIds: z.array(z.number().int()),
});

/** บันทึกสิทธิ์ทั้งหมด (ทุก Role) ในครั้งเดียว */
export async function PUT(req: Request) {
  const u = await apiUser({ admin: true });
  if (!u) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const parsed = z.object({ roles: z.array(Role).max(100) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  // กันผู้ดูแลระบบปิดสิทธิ์แอดมินจนไม่เหลือใคร
  if (!parsed.data.roles.some((r) => r.is_admin)) return NextResponse.json({ error: "ต้องมีอย่างน้อย 1 Role ที่เป็นผู้ดูแลระบบ" }, { status: 400 });

  for (const r of parsed.data.roles) {
    let id = r.id;
    if (id) {
      await exec("UPDATE role SET name=?, can_export=?, can_view_person=?, can_author=?, is_admin=? WHERE id=?",
        [r.name, +r.can_export, +r.can_view_person, +r.can_author, +r.is_admin, id]);
    } else {
      const exists = await one<{ id: number }>("SELECT id FROM role WHERE name=?", [r.name]);
      id = exists?.id ?? (await exec("INSERT INTO role (name, can_export, can_view_person, can_author, is_admin) VALUES (?,?,?,?,?)",
        [r.name, +r.can_export, +r.can_view_person, +r.can_author, +r.is_admin])).insertId;
    }
    await exec("DELETE FROM role_group WHERE role_id=?", [id]);
    for (const g of r.groupIds) await exec("INSERT IGNORE INTO role_group (role_id, group_id) VALUES (?,?)", [id, g]);
  }
  await audit({ userId: u.id, action: "edit_permission", detail: `roles: ${parsed.data.roles.map((r) => r.name).join(", ")}` });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const u = await apiUser({ admin: true });
  if (!u) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  const r = await one<{ is_admin: number; n: number }>("SELECT is_admin, (SELECT COUNT(*) FROM user_role WHERE role_id=role.id) AS n FROM role WHERE id=?", [id]);
  if (!r) return NextResponse.json({ error: "ไม่พบ Role" }, { status: 404 });
  if (r.n > 0) return NextResponse.json({ error: "ยังมีผู้ใช้อยู่ใน Role นี้" }, { status: 400 });
  await exec("DELETE FROM role WHERE id=?", [id]);
  await audit({ userId: u.id, action: "edit_permission", detail: `delete role ${id}` });
  return NextResponse.json({ ok: true });
}
