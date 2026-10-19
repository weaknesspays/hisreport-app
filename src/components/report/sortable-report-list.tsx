"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical, Loader2, RotateCcw, Save, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/config";
import { cn } from "@/lib/utils";
import { ReportCardBody, ReportList, type ReportListItem } from "./report-list";

/**
 * กล่องรายงานในหน้าหัวข้อ — ผู้ใช้กด "จัดเรียง" แล้วลากกล่อง (หรือกด ↑ ↓ บนมือถือ/คีย์บอร์ด) แล้วบันทึก
 * ลำดับของผู้ใช้ (user_report_order) มาก่อนลำดับกลางที่ผู้ดูแลจัด (group_report_order) · รายงานใหม่ที่ยังไม่เคยจัดจะต่อท้าย
 * ผู้ดูแลระบบเลือกบันทึกเป็น "ลำดับของฉัน" หรือ "ลำดับสำหรับทุกคน" (และล้างลำดับที่ผู้ใช้จัดเองได้)
 */
export function SortableReportList({ groupId, items, customized, globalOrder = false, isAdmin = false, personalUsers = 0, empty }: {
  groupId: number; items: ReportListItem[]; customized: boolean; globalOrder?: boolean; isAdmin?: boolean; personalUsers?: number; empty?: string;
}) {
  const router = useRouter();
  const [arranging, setArranging] = useState(false);
  const [order, setOrder] = useState(items);
  const [dragId, setDragId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<"me" | "all">(isAdmin ? "all" : "me");
  const [resetPersonal, setResetPersonal] = useState(false);

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
    if (scope === "all" && resetPersonal && !window.confirm(`ล้างลำดับที่ผู้ใช้ ${personalUsers} คนจัดเองไว้ในหัวข้อนี้ ให้ทุกคนเห็นลำดับกลางนี้?`)) return;
    setBusy(true);
    const res = await fetch(api(`/groups/${groupId}/order`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportIds: order.map((x) => x.id), scope, resetPersonal: scope === "all" && resetPersonal }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error(d?.error || "บันทึกลำดับไม่สำเร็จ"); return; }
    toast.success(scope === "all" ? `บันทึกลำดับสำหรับทุกคนแล้ว${d?.cleared ? ` · ล้างลำดับส่วนตัว ${d.cleared} คน` : ""}` : "บันทึกลำดับของคุณแล้ว");
    setArranging(false);
    router.refresh();
  }
  /** me = ล้างลำดับของฉัน (กลับไปใช้ลำดับกลาง/ตามชื่อ) · all = ล้างลำดับกลาง (ผู้ดูแลระบบ) */
  async function reset(which: "me" | "all") {
    const msg = which === "all" ? "ล้างลำดับสำหรับทุกคน? ผู้ที่ไม่ได้จัดเองจะเห็นเรียงตามชื่อรายงาน" : globalOrder ? "คืนค่าเป็นลำดับที่ผู้ดูแลระบบจัดให้?" : "คืนลำดับเริ่มต้น (เรียงตามชื่อรายงาน)?";
    if (!window.confirm(msg)) return;
    setBusy(true);
    const res = await fetch(api(`/groups/${groupId}/order${which === "all" ? "?scope=all" : ""}`), { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error("คืนค่าไม่สำเร็จ"); return; }
    toast.success(which === "all" ? "ล้างลำดับสำหรับทุกคนแล้ว" : "คืนค่าแล้ว");
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
            <span className="text-xs text-muted-foreground">
              {customized ? "ใช้ลำดับที่คุณจัดไว้" : globalOrder ? "ลำดับที่ผู้ดูแลระบบจัดให้" : ""}
              {isAdmin && personalUsers > 0 && `${customized || globalOrder ? " · " : ""}ผู้ใช้ ${personalUsers} คนจัดลำดับเองในหัวข้อนี้`}
            </span>
          </>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">ลากกล่องไปวางตำแหน่งที่ต้องการ หรือกด <ArrowUp className="inline size-3.5" /> <ArrowDown className="inline size-3.5" />{!isAdmin && " · ลำดับนี้เห็นเฉพาะคุณ"}</span>
            <div className="ml-auto flex flex-wrap gap-2">
              {customized && <Button variant="ghost" size="sm" onClick={() => reset("me")} disabled={busy}><RotateCcw /> {globalOrder ? "ใช้ลำดับของผู้ดูแล" : "คืนค่าเริ่มต้น"}</Button>}
              {isAdmin && globalOrder && <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => reset("all")} disabled={busy}><RotateCcw /> ล้างลำดับสำหรับทุกคน</Button>}
              <Button variant="outline" size="sm" onClick={cancel} disabled={busy}><X /> ยกเลิก</Button>
              <Button size="sm" onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Save />} บันทึกลำดับ</Button>
            </div>
          </>
        )}
      </div>

      {arranging && isAdmin && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">บันทึกเป็น</span>
          <div role="radiogroup" aria-label="บันทึกลำดับเป็น" className="inline-flex rounded-md border bg-background p-0.5">
            {([["all", "ลำดับสำหรับทุกคน", <Users key="u" className="size-4" />], ["me", "ลำดับของฉัน", null]] as const).map(([k, l, icon]) => (
              <button key={k} type="button" role="radio" aria-checked={scope === k} onClick={() => setScope(k)}
                className={cn("flex items-center gap-1.5 rounded px-2.5 py-1", scope === k ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{icon}{l}</button>
            ))}
          </div>
          {scope === "all" && (
            personalUsers > 0 ? (
              <label className="flex items-center gap-2">
                <Checkbox checked={resetPersonal} onCheckedChange={(v) => setResetPersonal(!!v)} />
                ใช้กับผู้ใช้ {personalUsers} คนที่จัดลำดับเองไว้ด้วย (ล้างลำดับส่วนตัว)
              </label>
            ) : <span className="text-muted-foreground">ผู้ใช้ทุกคนจะเห็นลำดับนี้ (ยังไม่มีใครจัดลำดับเอง)</span>
          )}
          {scope === "all" && personalUsers > 0 && !resetPersonal && <span className="text-xs text-muted-foreground">ไม่ติ๊ก = ผู้ที่จัดเองยังเห็นลำดับของตัวเอง</span>}
        </div>
      )}

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
