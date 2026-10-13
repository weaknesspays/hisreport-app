import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { hisDb } from "./db";

/**
 * ตรวจรหัสผ่านผู้ใช้ HIS ตาม CRC.md
 * รหัสผ่าน → CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, ไม่ reflect, xorout 0) → เลขฐานสิบ → เทียบ TRIM(dct.psswrd)
 * อ่านอย่างเดียว — ห้ามส่งค่า psswrd ออกนอกฟังก์ชันนี้ และห้ามบันทึกลง log
 */
export function crc16CcittFalse(buf: Uint8Array): number {
  let crc = 0xffff;
  for (const byte of buf) {
    crc ^= byte << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

/** แปลงข้อความเป็น byte แบบ TIS-620 (ไทย U+0E01–U+0E5B → 0xA1–0xFB) คืน null ถ้ามีอักขระที่แปลงไม่ได้ */
export function toTis620(s: string): Uint8Array | null {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c >= 0x0e01 && c <= 0x0e5b) out.push(c - 0x0e00 + 0xa0);
    else return null;
  }
  return Uint8Array.from(out);
}

/** ค่า CRC ที่อาจตรงกับ psswrd: UTF-8 เสมอ และ TIS-620 เมื่อรหัสผ่านมีอักขระนอก ASCII (CRC.md ข้อ 7) */
export function passwordCandidates(password: string): string[] {
  const list = [String(crc16CcittFalse(Buffer.from(password, "utf8")))];
  if (/[^\x00-\x7f]/.test(password)) {
    const tis = toTis620(password);
    if (tis) list.push(String(crc16CcittFalse(tis)));
  }
  return list;
}

export type HisAuthResult =
  | { ok: true; username: string; displayName: string }
  | { ok: false; reason: "not_found" | "suspended" | "bad_password" };

/** ขั้นตอนเดียวกับ his_authenticate() ของ ChartTracking (CRC.md ข้อ 4) */
export async function hisAuthenticate(username: string, password: string): Promise<HisAuthResult> {
  const [found] = await hisDb().query<RowDataPacket[]>(
    "SELECT dct, fname, lname, dspname, psswrd, statusdct FROM dct WHERE dct = ? LIMIT 1", [username]);
  const row = found[0];
  // collation ไม่สนตัวพิมพ์ → เทียบชื่อผู้ใช้แบบตรงตัวอีกชั้น
  if (!row || String(row.dct) !== username) return { ok: false, reason: "not_found" };
  if (String(row.statusdct ?? "").trim() === "1") return { ok: false, reason: "suspended" };
  const stored = String(row.psswrd ?? "").trim();
  if (!stored || !passwordCandidates(password).includes(stored)) return { ok: false, reason: "bad_password" };

  const full = `${String(row.fname ?? "").trim()} ${String(row.lname ?? "").trim()}`.trim();
  const displayName = full || String(row.dspname ?? "").trim() || String(row.dct);
  return { ok: true, username: String(row.dct), displayName };
}

/** ค้นหาผู้ใช้ HIS สำหรับหน้าเพิ่มผู้ใช้ (ไม่ดึง psswrd) */
export async function searchHisUsers(q: string) {
  const like = `%${q}%`;
  const [list] = await hisDb().query<RowDataPacket[]>(
    `SELECT dct, fname, lname, dspname, statusdct FROM dct
     WHERE dct LIKE ? OR fname LIKE ? OR lname LIKE ? OR dspname LIKE ?
     ORDER BY dct LIMIT 30`, [like, like, like, like]);
  return list.map((r) => ({
    username: String(r.dct),
    displayName: `${String(r.fname ?? "").trim()} ${String(r.lname ?? "").trim()}`.trim() || String(r.dspname ?? "").trim() || String(r.dct),
    suspended: String(r.statusdct ?? "").trim() === "1",
  }));
}
