"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen, Loader2, Pencil, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead, TablePager } from "@/components/ui/data-table";
import { useTable } from "@/lib/use-table";
import { api } from "@/lib/config";
import { thaiDate } from "@/lib/dates";
import { describeValues, fmtNumber } from "@/lib/format";
import { RenameDialog, DeleteDialog } from "./saved-dialogs";
import type { ParamDef, ParamValues } from "@/lib/report-types";

export type SavedItem = {
  id: number; report_id: number | null; report_version: number; name: string; note: string | null; report_name: string;
  values: ParamValues; params: ParamDef[]; row_count: number; has_person_data: boolean; data_bytes: number;
  generated_at: string; created_at: string; current_version: number | null;
};
type Usage = { files: number; bytes: number; maxFiles: number; maxBytes: number };

export function fmtBytes(n: number) {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

export function SavedManager({ items, usage, initialReport }: { items: SavedItem[]; usage: Usage; initialReport: number | null }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [reportFilter, setReportFilter] = useState<number | null>(initialReport);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [rename, setRename] = useState<SavedItem | null>(null);
  const [del, setDel] = useState<SavedItem[] | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) =>
      (!reportFilter || i.report_id === reportFilter) &&
      (!s || `${i.name} ${i.report_name} ${i.note ?? ""}`.toLowerCase().includes(s)));
  }, [items, q, reportFilter]);
  const t = useTable(list, { pageSize: 25, initialSort: { key: "created_at", dir: "desc" },
    getValue: (i, k) => (k === "cond" ? describeValues(i.values, new Map(i.params.map((p) => [p.name, p.label]))) : (i as Record<string, unknown>)[k]) });
  const H = (key: string, label: string, align?: "right") => <SortableHead label={label} sortKey={key} sort={t.sort} onSort={t.toggleSort} align={align} />;
  const filterName = reportFilter ? items.find((i) => i.report_id === reportFilter)?.report_name : null;
  const allSel = list.length > 0 && list.every((i) => sel.has(i.id));

  async function doDelete(ids: number[]) {
    setBusy(true);
    const res = await fetch(api("/saved/delete"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error("ลบไม่สำเร็จ"); return; }
    toast.success(`ลบ ${ids.length} แฟ้มแล้ว`);
    setSel(new Set());
    setDel(null);
    router.refresh();
  }

  const pctFiles = Math.min(100, (usage.files / usage.maxFiles) * 100);
  const pctBytes = Math.min(100, (usage.bytes / usage.maxBytes) * 100);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="ค้นหาชื่อแฟ้ม / รายงาน / หมายเหตุ" value={q} onChange={(e) => { setQ(e.target.value); t.resetPage(); }} className="h-9 w-72 pl-8" />
        </div>
        {filterName && (
          <Badge variant="secondary" className="h-7 gap-1 pr-1">
            รายงาน: {filterName}
            <button onClick={() => setReportFilter(null)} className="rounded p-0.5 hover:bg-muted" aria-label="ล้างตัวกรอง"><X className="size-3.5" /></button>
          </Badge>
        )}
        {sel.size > 0 && (
          <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setDel(items.filter((i) => sel.has(i.id)))}>
            <Trash2 /> ลบที่เลือก ({sel.size})
          </Button>
        )}
        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <Meter label={`${usage.files} / ${usage.maxFiles} แฟ้ม`} pct={pctFiles} />
          <Meter label={`${fmtBytes(usage.bytes)} / ${fmtBytes(usage.maxBytes)}`} pct={pctBytes} />
        </div>
      </div>

      {!items.length ? (
        <Card className="items-center py-14 text-center">
          <FolderOpen className="size-10 text-muted-foreground" />
          <div className="font-medium">ยังไม่มีแฟ้มที่บันทึกไว้</div>
          <p className="max-w-md text-sm text-muted-foreground">เปิดรายงาน → กด “ประมวลผล” → กด “บันทึกผล” ระบบจะเก็บผลพร้อมเงื่อนไขไว้ให้เปิดดูภายหลัง</p>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={allSel} onCheckedChange={(c) => setSel(c ? new Set(list.map((i) => i.id)) : new Set())} aria-label="เลือกทั้งหมด" /></TableHead>
                {H("name", "ชื่อแฟ้ม")}
                {H("cond", "เงื่อนไข")}
                {H("row_count", "แถว", "right")}
                {H("generated_at", "ข้อมูล ณ")}
                {H("data_bytes", "ขนาด", "right")}
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {t.rows.map((i) => (
                <TableRow key={i.id} data-state={sel.has(i.id) ? "selected" : undefined}>
                  <TableCell><Checkbox checked={sel.has(i.id)} onCheckedChange={(c) => { const n = new Set(sel); if (c) n.add(i.id); else n.delete(i.id); setSel(n); }} aria-label={`เลือก ${i.name}`} /></TableCell>
                  <TableCell className="max-w-md whitespace-normal">
                    <Link href={`/saved/${i.id}`} className="font-medium text-primary hover:underline">{i.name}</Link>
                    <div className="text-xs text-muted-foreground">
                      {i.report_name} · v{i.report_version}
                      {i.current_version === null && <span className="text-warning"> · รายงานต้นทางถูกลบแล้ว</span>}
                      {i.current_version !== null && i.current_version !== i.report_version && <span className="text-warning"> · รายงานถูกแก้ไขเป็น v{i.current_version}</span>}
                      {i.has_person_data && <span className="text-destructive"> · ข้อมูลบุคคล</span>}
                    </div>
                    {i.note && <div className="text-xs italic text-muted-foreground">{i.note}</div>}
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-normal text-xs text-muted-foreground">{describeValues(i.values, new Map(i.params.map((p) => [p.name, p.label]))) || "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNumber(i.row_count)}</TableCell>
                  <TableCell className="text-sm">{thaiDate(i.generated_at, true)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{fmtBytes(i.data_bytes)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="size-8" title="เปลี่ยนชื่อ" onClick={() => setRename(i)}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" title="ลบ" onClick={() => setDel([i])}><Trash2 className="size-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!list.length && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">ไม่พบแฟ้มตามที่ค้นหา</TableCell></TableRow>}
            </TableBody>
          </Table>
          <TablePager {...t} unit="แฟ้ม" setPageSize={t.setPageSize} className="border-t px-4 py-3" />
        </Card>
      )}

      {rename && <RenameDialog item={rename} onClose={() => setRename(null)} />}
      {del && <DeleteDialog items={del} busy={busy} onClose={() => setDel(null)} onConfirm={() => doDelete(del.map((d) => d.id))} />}
      {busy && <Loader2 className="fixed bottom-6 right-6 size-5 animate-spin text-muted-foreground" />}
    </div>
  );
}

function Meter({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="w-32">
      <div className="mb-1">{label}</div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={pct >= 90 ? "h-full bg-destructive" : pct >= 70 ? "h-full bg-warning" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
