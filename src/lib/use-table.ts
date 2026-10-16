import { useMemo, useState } from "react";
import { dateSortKey } from "./dates";

export type SortDir = "asc" | "desc";
export type SortState = { key: string; dir: SortDir } | null;

const numLike = /^-?\d+(\.\d+)?$/;

/** เทียบค่าสำหรับเรียงลำดับ: ค่าว่างไว้ท้ายเสมอ, ตัวเลข (รวมข้อความที่เป็นตัวเลข) เทียบเป็นตัวเลข, วันที่ (รวม dd/mm/yyyy พ.ศ.) เทียบตามวัน, นอกนั้นเทียบแบบภาษาไทย */
export function compareValues(a: unknown, b: unknown): number {
  const ea = a === null || a === undefined || a === "", eb = b === null || b === undefined || b === "";
  if (ea || eb) return ea && eb ? 0 : ea ? 1 : -1;
  if (typeof a === "boolean" || typeof b === "boolean") return Number(a) - Number(b);
  const na = typeof a === "number" ? a : numLike.test(String(a)) ? Number(a) : NaN;
  const nb = typeof b === "number" ? b : numLike.test(String(b)) ? Number(b) : NaN;
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  // วันที่ข้อความ เช่น 01/10/2569 → เทียบตามวันจริง (ไม่ใช่ตัวอักษร)
  const da = dateSortKey(a), db = dateSortKey(b);
  if (da && db) return da < db ? -1 : da > db ? 1 : 0;
  return String(a).localeCompare(String(b), "th", { numeric: true });
}

export function sortRows<T>(rows: T[], sort: SortState, getValue: (row: T, key: string) => unknown): T[] {
  if (!sort) return rows;
  const m = sort.dir === "asc" ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => {
      const va = getValue(x.r, sort.key), vb = getValue(y.r, sort.key);
      const empty = (v: unknown) => v === null || v === undefined || v === "";
      if (empty(va) || empty(vb)) return compareValues(va, vb) || x.i - y.i; // ค่าว่างท้ายเสมอ ไม่ว่าเรียงทางไหน
      return compareValues(va, vb) * m || x.i - y.i; // เสถียร: ค่าเท่ากันคงลำดับเดิม
    })
    .map((x) => x.r);
}

export const PAGE_SIZES = [10, 25, 50, 100, 200];

const defaultGet = (row: unknown, key: string) => (row as Record<string, unknown>)?.[key];

/**
 * เรียงลำดับ + แบ่งหน้าฝั่ง client — ใช้ร่วมกับ <SortableHead> / <TablePager>
 * กดหัวคอลัมน์: น้อย→มาก (ASC) → มาก→น้อย (DESC) → ลำดับเดิม
 */
export function useTable<T>(rows: T[], opts: { pageSize?: number; initialSort?: SortState; getValue?: (row: T, key: string) => unknown } = {}) {
  const [sort, setSort] = useState<SortState>(opts.initialSort ?? null);
  const [page, setPageRaw] = useState(0);
  const [pageSize, setPageSizeRaw] = useState(opts.pageSize ?? 25);
  const getValue = opts.getValue ?? (defaultGet as (row: T, key: string) => unknown);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- getValue มักเป็นฟังก์ชันใหม่ทุก render แต่ให้ผลเหมือนเดิม
  const sorted = useMemo(() => sortRows(rows, sort, getValue), [rows, sort]);
  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(page, pages - 1);
  const pageRows = useMemo(() => sorted.slice(cur * pageSize, cur * pageSize + pageSize), [sorted, cur, pageSize]);

  return {
    sorted, rows: pageRows, total, page: cur, pages, pageSize,
    from: total ? cur * pageSize + 1 : 0,
    to: Math.min(total, (cur + 1) * pageSize),
    sort,
    setPage: (p: number) => setPageRaw(Math.max(0, Math.min(p, pages - 1))),
    setPageSize: (n: number) => { setPageSizeRaw(n); setPageRaw(0); },
    /** กดหัวคอลัมน์ */
    toggleSort: (key: string) => {
      setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
      setPageRaw(0);
    },
    /** กลับไปหน้าแรก (เช่น เมื่อเปลี่ยนคำค้น) */
    resetPage: () => setPageRaw(0),
  };
}

export type TableState = ReturnType<typeof useTable>;
