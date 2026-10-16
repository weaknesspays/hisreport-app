"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZES, type SortState } from "@/lib/use-table";
import { fmtNumber } from "@/lib/format";
import { pageList } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/** หัวคอลัมน์ที่กดเรียงได้: น้อย→มาก → มาก→น้อย → ลำดับเดิม */
export function SortableHead({ label, sortKey, sort, onSort, className, align }: {
  label: React.ReactNode; sortKey: string; sort: SortState; onSort: (key: string) => void; className?: string; align?: "left" | "right" | "center";
}) {
  const active = sort?.key === sortKey ? sort.dir : null;
  const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
  const title = active === "asc" ? "เรียงน้อย → มาก (กดอีกครั้ง: มาก → น้อย)" : active === "desc" ? "เรียงมาก → น้อย (กดอีกครั้ง: ลำดับเดิม)" : "กดเพื่อเรียงน้อย → มาก";
  return (
    <TableHead aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"} className={cn("p-0", className)}>
      <button type="button" onClick={() => onSort(sortKey)} title={title}
        className={cn("flex h-10 w-full select-none items-center gap-1 whitespace-nowrap px-2 font-medium hover:text-foreground",
          align === "right" && "justify-end", align === "center" && "justify-center", active && "text-primary")}>
        {label}
        <Icon className={cn("size-3.5 shrink-0", !active && "opacity-40")} />
      </button>
    </TableHead>
  );
}

type PagerProps = {
  page: number; pages: number; total: number; from: number; to: number; pageSize: number;
  setPage: (p: number) => void; setPageSize?: (n: number) => void; pageSizes?: number[]; unit?: string; className?: string;
};

/** แถบเปลี่ยนหน้า: แสดง x–y จาก n · แถวต่อหน้า · « ‹ 1 2 3 › » */
export function TablePager({ page, pages, total, from, to, pageSize, setPage, setPageSize, pageSizes = PAGE_SIZES, unit = "รายการ", className }: PagerProps) {
  if (!total) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 text-sm", className)}>
      <span className="text-muted-foreground">แสดง {fmtNumber(from)}–{fmtNumber(to)} จาก {fmtNumber(total)} {unit}</span>
      {setPageSize && (
        <label className="flex items-center gap-1.5 text-muted-foreground">
          ต่อหน้า
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger size="sm" className="h-8 w-20"><SelectValue /></SelectTrigger>
            <SelectContent>{[...new Set([...pageSizes, pageSize])].sort((a, b) => a - b).map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </label>
      )}
      {pages > 1 && (
        <nav aria-label="เปลี่ยนหน้า" className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8" disabled={page === 0} onClick={() => setPage(0)} title="หน้าแรก"><ChevronsLeft /></Button>
          <Button variant="outline" size="icon" className="size-8" disabled={page === 0} onClick={() => setPage(page - 1)} title="ก่อนหน้า"><ChevronLeft /></Button>
          {pageList(page, pages).map((p, i) =>
            p === "…" ? <span key={`e${i}`} className="px-1 text-muted-foreground">…</span> : (
              <Button key={p} variant={p === page ? "default" : "outline"} size="sm" className="h-8 min-w-8 px-2 tabular-nums"
                aria-current={p === page ? "page" : undefined} onClick={() => setPage(p)}>{p + 1}</Button>
            ))}
          <Button variant="outline" size="icon" className="size-8" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} title="ถัดไป"><ChevronRight /></Button>
          <Button variant="outline" size="icon" className="size-8" disabled={page >= pages - 1} onClick={() => setPage(pages - 1)} title="หน้าสุดท้าย"><ChevronsRight /></Button>
        </nav>
      )}
    </div>
  );
}
