import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { createReport } from "@/lib/reports";
import { ReportSaveSchema } from "@/lib/report-schema";
import { assertSelectOnly, ReportError } from "@/lib/report-engine";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const u = await apiUser({ author: true });
  if (!u) return NextResponse.json({ error: "ไม่มีสิทธิ์สร้างรายงาน" }, { status: 403 });
  const parsed = ReportSaveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(" · ") }, { status: 400 });
  const s = parsed.data;
  if (!u.isAdmin && (s.meta.group_id === null || !u.groupIds.includes(s.meta.group_id))) {
    return NextResponse.json({ error: "สร้างรายงานได้เฉพาะในหัวข้อที่คุณมีสิทธิ์" }, { status: 403 });
  }
  try { assertSelectOnly(s.sql); } catch (e) { return NextResponse.json({ error: (e as ReportError).message }, { status: 400 }); }
  const id = await createReport(s, u.id);
  await audit({ userId: u.id, action: "edit_report", reportId: id, detail: "create" });
  return NextResponse.json({ ok: true, id });
}
