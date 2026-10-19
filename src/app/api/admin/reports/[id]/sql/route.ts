import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { getReport, getVersion, publishReport, saveReport } from "@/lib/reports";
import { validateSqlOnHis } from "@/lib/report-engine";
import { audit } from "@/lib/audit";

const Body = z.object({ sql: z.string().min(1).max(200_000), publish: z.boolean().optional(), note: z.string().max(500).optional() });

/**
 * แก้เฉพาะ SQL จากหน้ารายงาน (ผู้ดูแลระบบ) — ตัวแปร/คอลัมน์/การแสดงผลใช้ของเวอร์ชันล่าสุด
 * ตรวจกับ HIS (EXPLAIN) ก่อนบันทึก · เวอร์ชันล่าสุดเผยแพร่แล้ว → สร้างเวอร์ชันใหม่ (ประวัติเดิมยังย้อนได้)
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser({ admin: true });
  if (!u) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const id = Number((await params).id);
  const r = await getReport(id);
  if (!r) return NextResponse.json({ error: "ไม่พบรายงาน" }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const v = await getVersion(id, r.latest_version);
  if (!v) return NextResponse.json({ error: "ไม่พบเวอร์ชันของรายงาน" }, { status: 404 });

  const sql = parsed.data.sql.replace(/\r\n/g, "\n");
  if (sql.trim() === v.sql.replace(/\r\n/g, "\n").trim()) return NextResponse.json({ error: "SQL ไม่มีการเปลี่ยนแปลง" }, { status: 400 });
  const err = await validateSqlOnHis(sql, v.params);
  if (err) return NextResponse.json({ error: `SQL ใช้ไม่ได้: ${err}` }, { status: 422 });

  const version = await saveReport(id, {
    meta: {
      name: r.name, group_id: r.group_id, code: r.code, description: r.description, reference: r.reference, tags: r.tags, type: r.type,
      has_person_data: !!r.has_person_data, cache_ttl: r.cache_ttl, timeout_sec: r.timeout_sec, row_limit: r.row_limit,
    },
    sql, params: v.params, columns: v.columns, display: v.display, note: parsed.data.note || "แก้ SQL จากหน้ารายงาน",
  }, u.id);
  await audit({ userId: u.id, action: "edit_report", reportId: id, detail: `sql v${version} (หน้ารายงาน)` });
  if (parsed.data.publish) {
    await publishReport(id, version);
    await audit({ userId: u.id, action: "publish_report", reportId: id, detail: `v${version}` });
  }
  return NextResponse.json({ ok: true, version, published: !!parsed.data.publish });
}
