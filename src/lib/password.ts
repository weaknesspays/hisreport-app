import "server-only";
import crypto from "node:crypto";

/** กฎรหัสผ่านบัญชี local — คืนข้อความผิดพลาด หรือ null ถ้าผ่าน */
export function passwordProblem(pw: string, username: string): string | null {
  if (pw.length < 8) return "รหัสผ่านอย่างน้อย 8 ตัวอักษร";
  if (pw.length > 200) return "รหัสผ่านยาวเกินไป";
  if (!/[A-Za-z฀-๿]/.test(pw) || !/\d/.test(pw)) return "รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข";
  if (username && pw.toLowerCase().includes(username.toLowerCase())) return "รหัสผ่านต้องไม่มีชื่อผู้ใช้อยู่ในนั้น";
  if (/^(.)\1+$/.test(pw) || /^(?:12345678|password|qwerty)/i.test(pw)) return "รหัสผ่านเดาง่ายเกินไป";
  return null;
}

/** รหัสชั่วคราวสำหรับผู้ดูแลแจ้งผู้ใช้ (ตัดตัวที่สับสน 0/O 1/l/I) — ผู้ใช้ต้องเปลี่ยนตอนเข้าสู่ระบบครั้งแรก */
export function tempPassword(len = 10) {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", digits = "23456789";
  const all = letters + digits;
  const pick = (s: string) => s[crypto.randomInt(s.length)];
  const chars = [pick(letters), pick(digits), ...Array.from({ length: len - 2 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}
