import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { apiUser } from "@/lib/auth";
import { exec, one } from "@/lib/db";
import { audit } from "@/lib/audit";

const User = z.object({
  id: z.number().int().optional(),
  username: z.string().trim().min(1).max(50),
  display_name: z.string().trim().min(1).max(150),
  department: z.string().max(150).nullable().optional(),
  auth_source: z.enum(["his", "local"]),
  password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร").max(200).optional(),
  is_active: z.boolean(),
  roleIds: z.array(z.number().int()),
});

export async function POST(req: Request) {
  const u = await apiUser({ admin: true });
  if (!u) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const parsed = User.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(" · ") }, { status: 400 });
  const x = parsed.data;
  if (x.id === u.id && (!x.is_active)) return NextResponse.json({ error: "ปิดบัญชีของตัวเองไม่ได้" }, { status: 400 });

  const hash = x.password ? await bcrypt.hash(x.password, 10) : null;
  let id = x.id;
  if (id) {
    await exec("UPDATE app_user SET username=?, display_name=?, department=?, auth_source=?, is_active=? WHERE id=?",
      [x.username, x.display_name, x.department ?? null, x.auth_source, +x.is_active, id]);
    if (hash) await exec("UPDATE app_user SET password_hash=? WHERE id=?", [hash, id]);
  } else {
    if (await one("SELECT id FROM app_user WHERE username=?", [x.username])) return NextResponse.json({ error: "มีชื่อผู้ใช้นี้แล้ว" }, { status: 400 });
    if (x.auth_source === "local" && !hash) return NextResponse.json({ error: "บัญชี local ต้องกำหนดรหัสผ่าน" }, { status: 400 });
    id = (await exec("INSERT INTO app_user (username, display_name, department, auth_source, password_hash, is_active) VALUES (?,?,?,?,?,?)",
      [x.username, x.display_name, x.department ?? null, x.auth_source, hash, +x.is_active])).insertId;
    await exec("INSERT IGNORE INTO user_setting (user_id) VALUES (?)", [id]);
  }
  await exec("DELETE FROM user_role WHERE user_id=?", [id]);
  for (const r of x.roleIds) await exec("INSERT IGNORE INTO user_role (user_id, role_id) VALUES (?,?)", [id, r]);
  await audit({ userId: u.id, action: "edit_user", detail: `${x.id ? "update" : "create"} ${x.username} roles=${x.roleIds.join(",")}` });
  return NextResponse.json({ ok: true, id });
}
