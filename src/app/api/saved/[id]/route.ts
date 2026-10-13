import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { deleteSaved, SavedError, updateSaved } from "@/lib/saved";
import { audit } from "@/lib/audit";

const Patch = z.object({
  name: z.string().trim().min(1, "กรุณาตั้งชื่อแฟ้ม").max(200).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

/** เปลี่ยนชื่อ / หมายเหตุ */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  try {
    await updateSaved(u, Number((await params).id), parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof SavedError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const gone = await deleteSaved(u, [Number((await params).id)]);
  if (!gone.length) return NextResponse.json({ error: "ไม่พบแฟ้มนี้" }, { status: 404 });
  await audit({ userId: u.id, action: "delete_saved", reportId: gone[0].report_id, detail: `#${gone[0].id}: ${gone[0].name}` });
  return NextResponse.json({ ok: true });
}
