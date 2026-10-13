import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate } from "@/lib/auth";
import { signSession } from "@/lib/session";
import { SESSION_COOKIE, SESSION_HOURS } from "@/lib/config";
import { exec, one } from "@/lib/db";
import { audit } from "@/lib/audit";

const Body = z.object({ username: z.string().trim().min(1).max(50), password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
  const { username, password } = parsed.data;

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || null;
  let res;
  try {
    res = await authenticate(username, password, ip);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "เชื่อมต่อฐานข้อมูลของระบบไม่ได้" }, { status: 503 });
  }
  // HIS ล่ม ไม่ใช่ความผิดของผู้ใช้ — ไม่นับเป็น login_fail (กันถูกล็อกทั้งที่รหัสถูก)
  if (!res.ok && res.unavailable) return NextResponse.json({ error: res.error }, { status: 503 });
  if (!res.ok) {
    const u = await one<{ id: number }>("SELECT id FROM app_user WHERE username = ?", [username]);
    await audit({ userId: u?.id ?? null, action: "login_fail", detail: username });
    return NextResponse.json({ error: res.error }, { status: 401 });
  }

  await exec("UPDATE app_user SET last_login = NOW() WHERE id = ?", [res.id]);
  await audit({ userId: res.id, action: "login" });
  const token = await signSession({ uid: res.id, username });
  const out = NextResponse.json({ ok: true });
  out.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return out;
}
