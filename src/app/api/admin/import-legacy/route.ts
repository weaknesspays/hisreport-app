import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { importLegacy, previewLegacy } from "@/lib/legacy-import";
import { audit } from "@/lib/audit";

function hisError(e: unknown) {
  const err = e as { code?: string; message?: string };
  const offline = ["ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH", "ENOTFOUND"].includes(err.code ?? "");
  return NextResponse.json({ error: offline ? "เชื่อมต่อฐานข้อมูล HIS ไม่ได้ในขณะนี้" : `ผิดพลาด: ${err.message}` }, { status: 503 });
}

export async function GET() {
  const u = await apiUser({ admin: true });
  if (!u) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  try {
    const list = await previewLegacy();
    return NextResponse.json({ total: list.length, imported: list.filter((r) => r.imported).length, items: list });
  } catch (e) {
    return hisError(e);
  }
}

export async function POST(req: Request) {
  const u = await apiUser({ admin: true });
  if (!u) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { status?: string };
  try {
    const r = await importLegacy(u.id, body.status === "draft" ? "draft" : "published");
    await audit({ userId: u.id, action: "import_legacy", detail: `imported ${r.imported}, skipped ${r.skipped}` });
    return NextResponse.json(r);
  } catch (e) {
    return hisError(e);
  }
}
