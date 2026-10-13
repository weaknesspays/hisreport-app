import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { exec } from "@/lib/db";
import { canViewReport, getReport } from "@/lib/reports";

export async function PUT(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const r = await getReport(Number((await params).id));
  if (!r || !canViewReport(u, r)) return NextResponse.json({ error: "ไม่พบรายงาน" }, { status: 404 });
  await exec("INSERT IGNORE INTO user_favorite (user_id, report_id) VALUES (?,?)", [u.id, r.id]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  await exec("DELETE FROM user_favorite WHERE user_id=? AND report_id=?", [u.id, Number((await params).id)]);
  return NextResponse.json({ ok: true });
}
