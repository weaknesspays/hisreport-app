import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { exec, one } from "@/lib/db";
import { audit } from "@/lib/audit";

const Group = z.object({
  id: z.number().int().optional(),
  name: z.string().trim().min(1).max(150),
  icon: z.string().max(40).default("folder"),
  description: z.string().max(500).nullable().optional(),
  category: z.string().trim().max(150).nullable().optional(),
  sort: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

/** หา id หมวดหลักจากชื่อ (สร้างใหม่ถ้ายังไม่มี) */
async function categoryId(name: string | null | undefined) {
  if (!name) return null;
  const found = await one<{ id: number }>("SELECT id FROM report_category WHERE name = ?", [name]);
  if (found) return found.id;
  return (await exec("INSERT INTO report_category (name, sort) VALUES (?, 50)", [name])).insertId;
}

/** เพิ่ม/แก้ไขหัวข้อรายงาน */
export async function POST(req: Request) {
  const u = await apiUser({ admin: true });
  if (!u) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const parsed = Group.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const g = parsed.data;
  const cat = await categoryId(g.category);
  if (g.id) {
    await exec("UPDATE report_group SET name=?, icon=?, description=?, category_id=?, sort=?, is_active=? WHERE id=?",
      [g.name, g.icon, g.description ?? null, cat, g.sort, g.is_active ? 1 : 0, g.id]);
  } else {
    await exec("INSERT INTO report_group (name, icon, description, category_id, sort, is_active) VALUES (?,?,?,?,?,?)",
      [g.name, g.icon, g.description ?? null, cat, g.sort, g.is_active ? 1 : 0]);
  }
  await exec("DELETE FROM report_category WHERE id NOT IN (SELECT DISTINCT category_id FROM report_group WHERE category_id IS NOT NULL)");
  await audit({ userId: u.id, action: "edit_group", detail: `${g.id ? "update" : "create"} ${g.name}` });
  return NextResponse.json({ ok: true });
}
