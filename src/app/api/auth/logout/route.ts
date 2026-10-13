import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function POST() {
  const u = await getCurrentUser();
  if (u) await audit({ userId: u.id, action: "logout" });
  const out = NextResponse.json({ ok: true });
  out.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return out;
}
