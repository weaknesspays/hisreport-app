import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { apiUser } from "@/lib/auth";
import { exec, one } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hisUserExists } from "@/lib/his-auth";
import { passwordProblem, tempPassword } from "@/lib/password";

const User = z.object({
  id: z.number().int().optional(),
  username: z.string().trim().min(1).max(50).regex(/^[\p{L}\p{N}._-]+$/u, "ชื่อผู้ใช้ใช้ได้เฉพาะตัวอักษร ตัวเลข . _ -"),
  display_name: z.string().trim().min(1).max(150),
  department: z.string().max(150).nullable().optional(),
  auth_source: z.enum(["his", "local"]),
  password: z.string().max(200).optional(),
  generatePassword: z.boolean().optional(), // สุ่มรหัสชั่วคราว (ส่งกลับครั้งเดียว)
  mustChange: z.boolean().optional(),       // ให้เปลี่ยนรหัสตอนเข้าสู่ระบบครั้งแรก (ค่าเริ่มต้น true)
  is_active: z.boolean(),
  roleIds: z.array(z.number().int()),
});

/** มีชื่อนี้ใน HIS ไหม — null = ตรวจไม่ได้ (HIS ล่ม) */
async function inHis(username: string) {
  try { return await hisUserExists(username); } catch { return null; }
}

/**
 * เพิ่ม/แก้ผู้ใช้ (ผู้ดูแลระบบ)
 * - บัญชี HIS : ต้องมีชื่อใน hi.dct (เช็กเมื่อ HIS ต่อได้) · รหัสผ่านอยู่ที่ HIS ระบบนี้ไม่เก็บ
 * - บัญชี local: ห้ามใช้ชื่อที่มีใน HIS (ไม่งั้นเจ้าของบัญชี HIS ตัวจริง login ไม่ได้ และผู้ดูแลตั้งรหัสแทนเขาได้)
 *               ต้องมีรหัสผ่าน · ตั้ง/รีเซ็ตรหัส → บังคับเปลี่ยนตอนเข้าสู่ระบบ (เลือกได้) และ session เดิมของผู้ใช้หลุด
 */
export async function POST(req: Request) {
  const u = await apiUser({ admin: true });
  if (!u) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const parsed = User.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(" · ") }, { status: 400 });
  const x = parsed.data;
  if (x.id === u.id && !x.is_active) return NextResponse.json({ error: "ปิดบัญชีของตัวเองไม่ได้" }, { status: 400 });

  const prev = x.id ? await one<{ username: string; auth_source: "his" | "local"; has_pw: number }>(
    "SELECT username, auth_source, password_hash IS NOT NULL AS has_pw FROM app_user WHERE id = ?", [x.id]) : null;
  if (x.id && !prev) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
  if (x.id === u.id && prev?.auth_source !== x.auth_source) return NextResponse.json({ error: "เปลี่ยนชนิดบัญชีของตัวเองไม่ได้" }, { status: 400 });
  const dup = await one<{ id: number }>("SELECT id FROM app_user WHERE username = ? AND id <> ?", [x.username, x.id ?? 0]);
  if (dup) return NextResponse.json({ error: "มีชื่อผู้ใช้นี้แล้ว" }, { status: 400 });

  const nameChanged = !prev || prev.username !== x.username || prev.auth_source !== x.auth_source;
  if (nameChanged) {
    const exists = await inHis(x.username);
    if (x.auth_source === "local" && exists === true) {
      return NextResponse.json({ error: `“${x.username}” เป็นชื่อผู้ใช้ในโปรแกรม HIS อยู่แล้ว — เลือกชนิด “บัญชี HIS” หรือใช้ชื่ออื่นสำหรับบัญชีในระบบ` }, { status: 400 });
    }
    if (x.auth_source === "local" && exists === null) {
      return NextResponse.json({ error: "ตรวจชื่อกับ HIS ไม่ได้ในขณะนี้ (กันชื่อซ้ำกับบัญชี HIS) — ลองใหม่ภายหลัง" }, { status: 503 });
    }
    if (x.auth_source === "his" && exists === false) {
      return NextResponse.json({ error: `ไม่พบ “${x.username}” ในโปรแกรม HIS (ตัวพิมพ์เล็ก/ใหญ่ต้องตรงกัน) — ถ้าเป็นบุคคลภายนอกให้เลือก “บัญชีในระบบนี้”` }, { status: 400 });
    }
  }

  // รหัสผ่าน (เฉพาะ local)
  let plain: string | null = null;
  let generated: string | null = null;
  if (x.auth_source === "local") {
    if (x.generatePassword) plain = generated = tempPassword();
    else if (x.password) {
      const problem = passwordProblem(x.password, x.username);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      plain = x.password;
    }
    const hasPw = prev?.auth_source === "local" && !!Number(prev.has_pw);
    if (!plain && !hasPw) return NextResponse.json({ error: "บัญชีในระบบต้องกำหนดรหัสผ่าน (พิมพ์เอง หรือกด “สุ่มรหัสชั่วคราว”)" }, { status: 400 });
  }
  const hash = plain ? await bcrypt.hash(plain, 10) : null;
  const now = Math.floor(Date.now() / 1000); // เวลาเดียวกับ iat ของ session (ฝั่ง Node)
  const mustChange = x.mustChange ?? true;

  let id = x.id;
  if (id) {
    await exec("UPDATE app_user SET username=?, display_name=?, department=?, auth_source=?, is_active=? WHERE id=?",
      [x.username, x.display_name, x.department ?? null, x.auth_source, +x.is_active, id]);
    if (x.auth_source === "his") await exec("UPDATE app_user SET password_hash = NULL, must_change_pw = 0 WHERE id = ?", [id]);
    if (hash) await exec("UPDATE app_user SET password_hash = ?, must_change_pw = ?, password_changed_at = FROM_UNIXTIME(?) WHERE id = ?", [hash, +mustChange, now, id]);
  } else {
    id = (await exec(
      "INSERT INTO app_user (username, display_name, department, auth_source, password_hash, is_active, must_change_pw, password_changed_at) VALUES (?,?,?,?,?,?,?,?)",
      [x.username, x.display_name, x.department ?? null, x.auth_source, hash, +x.is_active, hash ? +mustChange : 0, null])).insertId;
    await exec("INSERT IGNORE INTO user_setting (user_id) VALUES (?)", [id]);
  }
  await exec("DELETE FROM user_role WHERE user_id=?", [id]);
  for (const r of x.roleIds) await exec("INSERT IGNORE INTO user_role (user_id, role_id) VALUES (?,?)", [id, r]);
  await audit({ userId: u.id, action: "edit_user", detail: `${x.id ? "update" : "create"} ${x.username} (${x.auth_source}) roles=${x.roleIds.join(",")}` });
  if (hash) await audit({ userId: u.id, action: "reset_password", detail: `${x.username}${generated ? " (สุ่มรหัสชั่วคราว)" : ""}${mustChange ? " · บังคับเปลี่ยน" : ""}` });
  return NextResponse.json({ ok: true, id, tempPassword: generated });
}
