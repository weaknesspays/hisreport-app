import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { searchHisUsers } from "@/lib/his-auth";

/** ค้นหาผู้ใช้จากตาราง dct ของ HIS (ไม่ดึงรหัสผ่าน) */
export async function GET(req: Request) {
  const u = await apiUser({ admin: true });
  if (!u) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ users: [] });
  try {
    return NextResponse.json({ users: await searchHisUsers(q.slice(0, 50)) });
  } catch {
    return NextResponse.json({ error: "เชื่อมต่อฐานข้อมูล HIS ไม่ได้ในขณะนี้" }, { status: 503 });
  }
}
