import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";
import { fmtNumber } from "@/lib/format";
import { pageList } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/**
 * รุ่นลิงก์ของ SortableHead / TablePager สำหรับหน้าที่เรียง/แบ่งหน้าฝั่ง server (ข้อมูลมาก เช่น ประวัติการใช้งาน)
 * ไม่มี state — ทุกการกดคือเปลี่ยน ?sort=&dir=&page=
 */
export function LinkSortHead({ label, sortKey, sort, dir, href, className, align }: {
  label: React.ReactNode; sortKey: string; sort: string | null; dir: "asc" | "desc"; href: (sort: string | null, dir: "asc" | "desc") => string;
  className?: string; align?: "left" | "right";
}) {
  const active = sort === sortKey ? dir : null;
  const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
  const next = active === "asc" ? href(sortKey, "desc") : active === "desc" ? href(null, "desc") : href(sortKey, "asc");
  return (
    <TableHead aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"} className={cn("p-0", className)}>
      <Link href={next} scroll={false}
        className={cn("flex h-10 w-full select-none items-center gap-1 whitespace-nowrap px-2 font-medium hover:text-foreground", align === "right" && "justify-end", active && "text-primary")}>
        {label}
        <Icon className={cn("size-3.5 shrink-0", !active && "opacity-40")} />
      </Link>
    </TableHead>
  );
}

export function LinkPager({ page, pages, total, pageSize, href, unit = "รายการ" }: {
  page: number; pages: number; total: number; pageSize: number; href: (page: number) => string; unit?: string;
}) {
  if (!total) return null;
  const from = page * pageSize + 1, to = Math.min(total, (page + 1) * pageSize);
  const Nav = ({ p, disabled, title, children }: { p: number; disabled: boolean; title: string; children: React.ReactNode }) =>
    disabled ? <Button variant="outline" size="icon" className="size-8" disabled title={title}>{children}</Button>
      : <Button variant="outline" size="icon" className="size-8" asChild title={title}><Link href={href(p)}>{children}</Link></Button>;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <span className="text-muted-foreground">แสดง {fmtNumber(from)}–{fmtNumber(to)} จาก {fmtNumber(total)} {unit}</span>
      {pages > 1 && (
        <nav aria-label="เปลี่ยนหน้า" className="ml-auto flex items-center gap-1">
          <Nav p={0} disabled={page === 0} title="หน้าแรก"><ChevronsLeft /></Nav>
          <Nav p={page - 1} disabled={page === 0} title="ก่อนหน้า"><ChevronLeft /></Nav>
          {pageList(page, pages).map((p, i) =>
            p === "…" ? <span key={`e${i}`} className="px-1 text-muted-foreground">…</span> : (
              <Button key={p} variant={p === page ? "default" : "outline"} size="sm" className="h-8 min-w-8 px-2 tabular-nums" asChild>
                <Link href={href(p)} aria-current={p === page ? "page" : undefined}>{p + 1}</Link>
              </Button>
            ))}
          <Nav p={page + 1} disabled={page >= pages - 1} title="ถัดไป"><ChevronRight /></Nav>
          <Nav p={pages - 1} disabled={page >= pages - 1} title="หน้าสุดท้าย"><ChevronsRight /></Nav>
        </nav>
      )}
    </div>
  );
}
