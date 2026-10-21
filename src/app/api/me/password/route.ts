import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { exec, one } from "@/lib/db";
import { passwordProblem } from "@/lib/password";
import { signSession } from "@/lib/session";
import { SESSION_COOKIE, SESSION_HOURS } from "@/lib/config";
import { audit } from "@/lib/audit";

const Body = z.object({ current: z.string().min(1).max(200), next: z.string().min(1).max(200) });

/**
 * ผู้ใช้บัญชี local เปลี่ยนรหัสผ่านเอง (รวมกรณีถูกบังคับเปลี่ยนหลังผู้ดูแลตั้งรหัสให้)
 * ใช้ getCurrentUser ตรง ๆ (ไม่ใช่ apiUser) เพราะ apiUser ปฏิเสธผู้ที่ยังต้องเปลี่ยนรหัส
 * สำเร็จ → session อื่นของผู้ใช้นี้ใช้ไม่ได้ และออก session ใหม่ให้เครื่องนี้
 */
export async function PUT(req: Request) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (u.authSource !== "local") return NextResponse.json({ error: "บัญชี HIS เปลี่ยนรหัสผ่านในโปรแกรม HIS" }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "กรุณากรอกรหัสผ่านให้ครบ" }, { status: 400 });
  const { current, next } = parsed.data;

  const row = await one<{ password_hash: string | null }>("SELECT password_hash FROM app_user WHERE id = ?", [u.id]);
  if (!row?.password_hash || !(await bcrypt.compare(current, row.password_hash))) {
    return NextResponse.json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, { status: 400 });
  }
  const problem = passwordProblem(next, u.username);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (await bcrypt.compare(next, row.password_hash)) return NextResponse.json({ error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม" }, { status: 400 });

  // เวลาจากฝั่ง Node (ตรงกับ iat ของ session) — ไม่ใช้ NOW() ของฐาน กันนาฬิกาคลาดแล้วเด้งออก
  const now = Math.floor(Date.now() / 1000);
  await exec("UPDATE app_user SET password_hash = ?, must_change_pw = 0, password_changed_at = FROM_UNIXTIME(?) WHERE id = ?",
    [await bcrypt.hash(next, 10), now, u.id]);
  await audit({ userId: u.id, action: "change_password" });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession({ uid: u.id, username: u.username }), {
    httpOnly: true, sameSite: "lax", secure: req.headers.get("x-forwarded-proto") === "https", path: "/", maxAge: SESSION_HOURS * 3600,
  });
  return res;
}
