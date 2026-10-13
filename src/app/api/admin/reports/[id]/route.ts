import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { exec } from "@/lib/db";
import { getReport, publishReport, saveReport } from "@/lib/reports";
import { ReportSaveSchema } from "@/lib/report-schema";
import { assertSelectOnly, ReportError } from "@/lib/report-engine";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

async function authorFor(id: number) {
  const u = await apiUser({ author: true });
  if (!u) return { u: null, r: null };
  const r = await getReport(id);
  if (!r) return { u, r: null };
  if (!u.isAdmin && (r.group_id === null || !u.groupIds.includes(r.group_id))) return { u: null, r };
  return { u, r };
}

/** บันทึก (ร่าง) และเผยแพร่ถ้า publish=true */
export async function PUT(req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  const { u, r } = await authorFor(id);
  if (!u) return NextResponse.json({ error: "ไม่มีสิทธิ์แก้ไขรายงานนี้" }, { status: 403 });
  if (!r) return NextResponse.json({ error: "ไม่พบรายงาน" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = ReportSaveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ") }, { status: 400 });
  try { assertSelectOnly(parsed.data.sql); } catch (e) { return NextResponse.json({ error: (e as ReportError).message }, { status: 400 }); }

  const version = await saveReport(id, parsed.data, u.id);
  await audit({ userId: u.id, action: "edit_report", reportId: id, detail: `save v${version}` });
  if (body?.publish) {
    if (!u.isAdmin) return NextResponse.json({ ok: true, version, warning: "บันทึกแล้ว — การเผยแพร่ต้องให้ผู้ดูแลระบบอนุมัติ" });
    await publishReport(id, version);
    await audit({ userId: u.id, action: "publish_report", reportId: id, detail: `v${version}` });
  }
  return NextResponse.json({ ok: true, version, published: !!body?.publish });
}

/** เผยแพร่เวอร์ชันที่ระบุ (ย้อนเวอร์ชัน) หรือเปลี่ยนสถานะ */
export async function PATCH(req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  const u = await apiUser({ admin: true });
  if (!u) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const r = await getReport(id);
  if (!r) return NextResponse.json({ error: "ไม่พบรายงาน" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { publishVersion?: number; status?: string };
  if (body.publishVersion) {
    const v = await publishReport(id, Number(body.publishVersion));
    await audit({ userId: u.id, action: "publish_report", reportId: id, detail: `v${v}` });
    return NextResponse.json({ ok: true });
  }
  if (body.status === "disabled" || (body.status === "published" && r.published_version) || body.status === "draft") {
    await exec("UPDATE report SET status=? WHERE id=?", [body.status, id]);
    await audit({ userId: u.id, action: "edit_report", reportId: id, detail: `status ${body.status}` });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
}
