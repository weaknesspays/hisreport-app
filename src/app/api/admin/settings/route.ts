import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { setSetting } from "@/lib/settings";
import { audit } from "@/lib/audit";

const Body = z.object({ login_lockout: z.boolean() });

export async function PUT(req: Request) {
  const u = await apiUser({ admin: true });
  if (!u) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const on = parsed.data.login_lockout;
  await setSetting("login_lockout", on ? "1" : "0", u.id);
  await audit({ userId: u.id, action: "edit_setting", detail: `จำกัดการ login ผิด: ${on ? "เปิด" : "ปิด"}` });
  return NextResponse.json({ ok: true });
}
