import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { exec } from "@/lib/db";
import { isThemeColor, isThemeMode } from "@/lib/config";

export async function PUT(req: Request) {
  const u = await apiUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { theme?: unknown; color?: unknown };
  const theme = isThemeMode(body.theme) ? body.theme : u.theme;
  const color = isThemeColor(body.color) ? body.color : u.color;
  await exec(
    "INSERT INTO user_setting (user_id, theme, color) VALUES (?,?,?) ON DUPLICATE KEY UPDATE theme=VALUES(theme), color=VALUES(color)",
    [u.id, theme, color]);
  return NextResponse.json({ ok: true, theme, color });
}
