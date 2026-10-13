import { NextResponse } from "next/server";
import { loadReportForApi } from "@/lib/report-access";
import { loadOptions, ReportError } from "@/lib/report-engine";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const r = await loadReportForApi(id, url.searchParams.get("latest") === "1");
  if (!r.ok) return r.res;
  const def = r.version.params.find((p) => p.name === url.searchParams.get("param"));
  if (!def) return NextResponse.json({ error: "ไม่พบตัวแปร" }, { status: 404 });
  try {
    return NextResponse.json({ options: await loadOptions(def) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof ReportError ? e.message : "โหลดตัวเลือกไม่สำเร็จ" }, { status: 422 });
  }
}
