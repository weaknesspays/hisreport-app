import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { hisDb } from "@/lib/db";

type Row = { icd10: string; icd10name: string | null; name_t: string | null; icd_use: string | null };
const out = (r: Row) => ({ code: r.icd10, name: r.icd10name ?? "", nameTh: r.name_t ?? "", billable: r.icd_use === "1" });
const norm = (s: string) => s.trim().toUpperCase().replace(/\./g, "");

/**
 * ค้นหารหัส ICD10 จาก hi.icd101 (อ่านอย่างเดียว) สำหรับช่องกรอก ICD10 ในหน้ารายงาน
 * ?q=J44 | J44.0  → รหัสที่ขึ้นต้นด้วยคำค้น (รับเฉพาะรหัส ไม่ค้นจากชื่อโรค)
 * ?codes=J440,J445                → ชื่อของรหัสที่เลือกไว้
 */
export async function GET(req: Request) {
  const u = await apiUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const db = hisDb();

  const codes = (sp.get("codes") ?? "").split(",").map(norm).filter((c) => /^[A-Z][0-9A-Z]{1,6}$/.test(c)).slice(0, 50);
  if (codes.length) {
    const [rows] = await db.query(`SELECT icd10, icd10name, name_t, icd_use FROM icd101 WHERE icd10 IN (${codes.map(() => "?").join(",")})`, codes);
    return NextResponse.json({ items: (rows as Row[]).map(out) });
  }

  const code = norm((sp.get("q") ?? "").slice(0, 20));
  const items: Row[] = [];
  if (/^[A-Z][0-9A-Z]{0,6}$/.test(code)) {
    const [rows] = await db.query("SELECT icd10, icd10name, name_t, icd_use FROM icd101 WHERE icd10 LIKE ? ORDER BY icd10 LIMIT 30", [`${code}%`]);
    items.push(...(rows as Row[]));
  }
  return NextResponse.json({ items: items.map(out) });
}
