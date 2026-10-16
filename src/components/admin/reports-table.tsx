"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead, TablePager } from "@/components/ui/data-table";
import { useTable } from "@/lib/use-table";
import { thaiDate } from "@/lib/dates";
import type { ReportRow } from "@/lib/reports";

const STATUS = {
  published: { label: "เผยแพร่", cls: "border-success/40 text-success" },
  draft: { label: "ร่าง", cls: "border-warning/50 text-warning" },
  disabled: { label: "ปิดใช้งาน", cls: "text-muted-foreground" },
};

export function ReportsTable({ items }: { items: ReportRow[] }) {
  const t = useTable(items, { pageSize: 50 });
  const H = (key: keyof ReportRow, label: string, className?: string) => <SortableHead label={label} sortKey={key} sort={t.sort} onSort={t.toggleSort} className={className} />;
  return (
    <Card className="gap-0 py-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>{H("id", "#", "w-14")}{H("name", "ชื่อรายงาน")}{H("group_name", "หัวข้อ")}{H("status", "สถานะ")}{H("updated_at", "แก้ไขล่าสุด")}<TableHead /></TableRow>
          </TableHeader>
          <TableBody>
            {t.rows.map((r) => {
              const st = STATUS[r.status];
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{r.id}</TableCell>
                  <TableCell className="max-w-md">
                    <Link href={`/admin/reports/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                    {r.legacy_query_id && <span className="ml-1 text-xs text-muted-foreground">(เดิม #{r.legacy_query_id})</span>}
                    {!!r.has_person_data && <Badge variant="outline" className="ml-1 border-destructive/40 text-destructive">บุคคล</Badge>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{r.group_name ?? "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="outline" className={st.cls}>{st.label}{r.published_version ? ` v${r.published_version}` : ""}</Badge>
                    {r.published_version !== null && r.latest_version > r.published_version && <Badge variant="outline" className="ml-1 border-warning/50 text-warning">ร่าง v{r.latest_version}</Badge>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{thaiDate(r.updated_at, true)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button variant="ghost" size="sm" asChild><Link href={`/admin/reports/${r.id}`}>แก้ไข</Link></Button>
                    <Button variant="ghost" size="sm" asChild><Link href={`/reports/${r.id}`}>เปิด</Link></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!items.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">ยังไม่มีรายงาน — สร้างใหม่ หรือ นำเข้าจาก rep_query_item</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <TablePager {...t} unit="รายงาน" setPageSize={t.setPageSize} className="border-t px-4 py-3" />
    </Card>
  );
}
