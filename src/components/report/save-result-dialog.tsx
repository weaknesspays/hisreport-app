"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/config";
import { fiscalRange, fiscalYearOf, thaiDate } from "@/lib/dates";
import { describeValues, fmtNumber } from "@/lib/format";
import type { ParamDef, ParamValues, RunResult } from "@/lib/report-types";

/** ชื่อแฟ้มเริ่มต้น เช่น "รายงาน Admit E42-E44 · ปีงบ 2569" */
export function defaultSavedName(reportName: string, params: ParamDef[], values: ParamValues) {
  const parts: string[] = [];
  for (const p of params) {
    const v = values[p.name];
    if (p.type === "daterange" && v && typeof v === "object" && !Array.isArray(v)) {
      const fy = fiscalYearOf(v.end);
      const r = fiscalRange(fy);
      parts.push(v.start === r.start && v.end === r.end ? `ปีงบ ${fy}` : `${thaiDate(v.start)}–${thaiDate(v.end)}`);
    } else if (p.type === "fiscal_year" && v) parts.push(`ปีงบ ${v}`);
  }
  return [reportName, ...parts].join(" · ").slice(0, 200);
}

export function SaveResultDialog({ open, onOpenChange, reportId, reportName, params, values, result }: {
  open: boolean; onOpenChange: (v: boolean) => void; reportId: number; reportName: string;
  params: ParamDef[]; values: ParamValues; result: RunResult;
}) {
  const router = useRouter();
  const [name, setName] = useState(() => defaultSavedName(reportName, params, values));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const conditions = describeValues(values, new Map(params.map((p) => [p.name, p.label])));

  async function save() {
    setBusy(true);
    const res = await fetch(api("/saved"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, values, name, note: note || null }),
    }).catch(() => null);
    setBusy(false);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) { toast.error(d?.error || "บันทึกไม่สำเร็จ"); return; }
    onOpenChange(false);
    toast.success("บันทึกแฟ้มแล้ว", { action: { label: "เปิดแฟ้ม", onClick: () => router.push(`/saved/${d.id}`) } });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>บันทึกผลรายงาน</DialogTitle>
          <DialogDescription>เก็บผลชุดนี้ไว้เปิดดูภายหลังโดยไม่ต้องประมวลผลใหม่ — เห็นเฉพาะคุณ</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sv-name">ชื่อแฟ้ม</Label>
            <Input id="sv-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sv-note">หมายเหตุ <span className="font-normal text-muted-foreground">(ไม่บังคับ)</span></Label>
            <Textarea id="sv-note" rows={2} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ใช้ประกอบการประชุม กก.บริหาร ต.ค. 69" />
          </div>
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="mb-1 font-medium">ระบบจะเก็บให้อัตโนมัติ</div>
            <ul className="space-y-0.5 text-muted-foreground">
              <li>รายงาน: {reportName}</li>
              <li>เงื่อนไข: {conditions || "-"}</li>
              <li>ข้อมูล {fmtNumber(result.rowCount)} แถว · ดึงจาก HIS เมื่อ {new Date(result.generatedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</li>
              <li>SQL และรูปแบบคอลัมน์ของเวอร์ชันที่ใช้</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" asChild><Link href="/saved">ดูแฟ้มทั้งหมด</Link></Button>
          <Button onClick={save} disabled={busy || !name.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Save />} บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
