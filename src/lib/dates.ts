// วันที่แบบ YYYY-MM-DD (ไม่ยุ่ง timezone) และปีงบประมาณ (1 ต.ค. – 30 ก.ย.)

export function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(s: string, n: number) {
  const [y, m, d] = s.split("-").map(Number);
  return ymd(new Date(y, m - 1, d + n));
}

/** ปีงบ พ.ศ. ของวันที่ */
export function fiscalYearOf(s: string) {
  const [y, m] = s.split("-").map(Number);
  return (m >= 10 ? y + 1 : y) + 543;
}

export function fiscalRange(fyBE: number) {
  const ce = fyBE - 543;
  return { start: `${ce - 1}-10-01`, end: `${ce}-09-30` };
}

export function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** แปลงคำค่าเริ่มต้นเป็นวันที่: today, fy_start, fy_end, month_start, -30d */
export function resolveDateWord(word: string | undefined, today = ymd(new Date())): string | null {
  if (!word) return null;
  if (isYmd(word)) return word;
  const fy = fiscalRange(fiscalYearOf(today));
  switch (word) {
    case "today": return today;
    case "fy_start": return fy.start;
    case "fy_end": return fy.end;
    case "month_start": return today.slice(0, 8) + "01";
  }
  const m = /^(-?\d+)d$/.exec(word);
  return m ? addDays(today, Number(m[1])) : null;
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function thaiDate(s: string | null | undefined, withTime = false) {
  if (!s || s.startsWith("0000")) return "";
  const [d, t] = s.split(/[ T]/);
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m) return s;
  const out = `${day} ${TH_MONTHS[m - 1]} ${y + 543}`;
  return withTime && t ? `${out} ${t.slice(0, 5)}` : out;
}

const ISO_DT = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/;
const DMY_DT = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * แปลงข้อความวันที่ → "YYYY-MM-DD HH:MM:SS" (ค.ศ.) ไว้เรียงลำดับ/จัดกลุ่ม — ไม่ใช่รูปแบบวันที่ → null
 * รับ: 2026-10-01, 2026-10-01 08:30:00, 01/10/2569, 1/10/2026 08:30 (ปี > 2400 ถือเป็น พ.ศ.)
 * ใช้กับผลจาก DATE_FORMAT(..., '%d/%m/%Y') ที่เป็นข้อความ ซึ่งถ้าเรียงแบบตัวอักษรจะเรียงตาม "วัน" ก่อน "เดือน"
 */
export function dateSortKey(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  const p = (n: number | string) => String(n).padStart(2, "0");
  let y: number, mo: number, d: number, h = "00", mi = "00", se = "00";
  let m = ISO_DT.exec(s);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; h = m[4] ?? h; mi = m[5] ?? mi; se = m[6] ?? se; }
  else if ((m = DMY_DT.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; h = m[4] ?? h; mi = m[5] ?? mi; se = m[6] ?? se; }
  else return null;
  if (y > 2400) y -= 543;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${p(mo)}-${p(d)} ${p(h)}:${mi}:${se}`;
}
