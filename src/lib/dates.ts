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
