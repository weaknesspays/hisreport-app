/** เลขหน้าที่แสดงในแถบเปลี่ยนหน้า (เริ่ม 0): 1 … 4 5 [6] 7 8 … 20 */
export function pageList(cur: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i);
  const out: (number | "…")[] = [0];
  const s = Math.max(1, Math.min(cur - 1, pages - 4)), e = Math.min(pages - 2, Math.max(cur + 1, 3));
  if (s > 1) out.push("…");
  for (let i = s; i <= e; i++) out.push(i);
  if (e < pages - 2) out.push("…");
  out.push(pages - 1);
  return out;
}
