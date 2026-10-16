import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { loadSaved, SavedError } from "@/lib/saved";
import { buildWorkbook, xlsxResponseHeaders } from "@/lib/excel";
import { describeValues } from "@/lib/format";
import { thaiDate } from "@/lib/dates";
import { audit } from "@/lib/audit";

/** ส่งออก Excel จากแฟ้มที่บันทึกไว้ (ไม่คิวรี่ HIS) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!u.canExport) return NextResponse.json({ error: "ไม่มีสิทธิ์ส่งออก Excel" }, { status: 403 });
  try {
    const s = await loadSaved(u, Number((await params).id));
    if (!s.result.rows.length) return NextResponse.json({ error: "ไม่มีข้อมูลให้ส่งออก" }, { status: 422 });
    const buf = await buildWorkbook({
      title: `${s.report_name} — ${s.name}`,
      conditions: describeValues(s.values, new Map(s.params.map((p) => [p.name, p.label]))),
      dataNote: `ข้อมูลที่บันทึกไว้ ณ ${thaiDate(s.generated_at, true)} (รายงานเวอร์ชัน ${s.report_version})`,
      exportedBy: `${u.displayName} (${u.username})`,
      columns: s.result.columns, columnTypes: s.result.columnTypes, colDefs: s.columns,
      rows: s.result.rows, masked: s.result.masked, truncated: s.truncated, rowCount: s.row_count,
    });
    await audit({ userId: u.id, action: "export_saved", reportId: s.report_id, rowCount: s.row_count, detail: `#${s.id}: ${s.name}` });
    return new NextResponse(buf as ArrayBuffer, { headers: xlsxResponseHeaders(`saved-${s.id}`, s.name) });
  } catch (e) {
    if (e instanceof SavedError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
