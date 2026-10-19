"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical, Loader2, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/config";
import { cn } from "@/lib/utils";
import { ReportCardBody, ReportList, type ReportListItem } from "./report-list";

/**
 * กล่องรายงานในหน้าหัวข้อ — ผู้ใช้กด "จัดเรียง" แล้วลากกล่อง (หรือกด ↑ ↓ บนมือถือ/คีย์บอร์ด) แล้วบันทึก
 * ลำดับเก็บแยกต่อผู้ใช้ (user_report_order) · รายงานใหม่ที่ยังไม่เคยจัดจะต่อท้าย
 */
export function SortableReportList({ groupId, items, customized, empty }: { groupId: number; items: ReportListItem[]; customized: boolean; empty?: string }) {
  const router = useRouter();
  const [arranging, setArranging] = useState(false);
  const [order, setOrder] = useState(items);
  const [dragId, setDragId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const start = () => { setOrder(items); setArranging(true); };
  const cancel = () => { setOrder(items); setArranging(false); setDragId(null); };

  /** ย้ายกล่อง id ไปตำแหน่งของ overId (ลากผ่านแล้วสลับทันที เห็นผลระหว่างลาก) */
  function moveOver(id: number, overId: number) {
    if (id === overId) return;
    setOrder((cur) => {
      const from = cur.findIndex((x) => x.id === id), to = cur.findIndex((x) => x.id === overId);
      if (from < 0 || to < 0) return cur;
      const next = [...cur];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  }
  function step(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  }

  async function save() {
    setBusy(true);
    const res = await fetch(api(`/groups/${groupId}/order`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportIds: order.map((x) => x.id) }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error((await res?.json().catch(() => null))?.error || "บันทึกลำดับไม่สำเร็จ"); return; }
    toast.success("บันทึกลำดับแล้ว");
    setArranging(false);
    router.refresh();
  }
  async function reset() {
    if (!window.confirm("คืนลำดับเริ่มต้น (เรียงตามชื่อรายงาน)?")) return;
    setBusy(true);
    const res = await fetch(api(`/groups/${groupId}/order`), { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error("คืนค่าไม่สำเร็จ"); return; }
    toast.success("คืนลำดับเริ่มต้นแล้ว");
    setArranging(false);
    router.refresh();
  }

  if (!items.length) return <ReportList items={items} empty={empty} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!arranging ? (
          <>
            {items.length > 1 && <Button variant="outline" size="sm" onClick={start}><ArrowUpDown /> จัดเรียง</Button>}
            {customized && <span className="text-xs text-muted-foreground">ใช้ลำดับที่คุณจัดไว้</span>}
          </>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">ลากกล่องไปวางตำแหน่งที่ต้องการ หรือกด <ArrowUp className="inline size-3.5" /> <ArrowDown className="inline size-3.5" /> · ลำดับนี้เห็นเฉพาะคุณ</span>
            <div className="ml-auto flex flex-wrap gap-2">
              {customized && <Button variant="ghost" size="sm" onClick={reset} disabled={busy}><RotateCcw /> คืนค่าเริ่มต้น</Button>}
              <Button variant="outline" size="sm" onClick={cancel} disabled={busy}><X /> ยกเลิก</Button>
              <Button size="sm" onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Save />} บันทึกลำดับ</Button>
            </div>
          </>
        )}
      </div>

      {!arranging ? (
        <ReportList items={items} empty={empty} />
      ) : (
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="ลำดับรายงาน">
          {order.map((r, i) => (
            <li key={r.id} draggable
              onDragStart={(e) => { setDragId(r.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(r.id)); }}
              onDragEnter={(e) => { e.preventDefault(); if (dragId !== null) moveOver(dragId, r.id); }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
              onDrop={(e) => e.preventDefault()}
              onDragEnd={() => setDragId(null)}
              className={cn("cursor-grab select-none active:cursor-grabbing", dragId === r.id && "opacity-40")}>
              <ReportCardBody r={r} className={cn("border-dashed", dragId === r.id ? "border-primary" : "hover:border-primary")}>
                <div className="-my-1 -mr-1 flex shrink-0 flex-col items-center gap-0.5">
                  <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === 0} onClick={() => step(i, -1)} aria-label={`เลื่อน ${r.name} ขึ้น`}><ArrowUp className="size-4" /></Button>
                  <span className="flex items-center gap-0.5 text-xs tabular-nums text-muted-foreground"><GripVertical className="size-4" />{i + 1}</span>
                  <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === order.length - 1} onClick={() => step(i, 1)} aria-label={`เลื่อน ${r.name} ลง`}><ArrowDown className="size-4" /></Button>
                </div>
              </ReportCardBody>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
