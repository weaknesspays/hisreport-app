import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { deleteSaved } from "@/lib/saved";
import { audit } from "@/lib/audit";

/** ลบหลายแฟ้มพร้อมกัน — ลบได้เฉพาะของตัวเอง */
export async function POST(req: Request) {
  const u = await apiUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const parsed = z.object({ ids: z.array(z.number().int().positive()).min(1).max(200) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ไม่ได้เลือกแฟ้ม" }, { status: 400 });
  const gone = await deleteSaved(u, parsed.data.ids);
  for (const g of gone) await audit({ userId: u.id, action: "delete_saved", reportId: g.report_id, detail: `#${g.id}: ${g.name}` });
  return NextResponse.json({ deleted: gone.length });
}
