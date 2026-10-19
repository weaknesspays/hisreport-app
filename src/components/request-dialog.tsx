"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/config";

export const REQUEST_TYPE: Record<string, string> = { new: "รายงานใหม่", change: "แก้ไขรายงานเดิม", data_issue: "แจ้งตัวเลขผิดปกติ" };
export const REQUEST_URGENCY: Record<string, { label: string; cls: string }> = {
  normal: { label: "ปกติ", cls: "" }, urgent: { label: "ด่วน", cls: "border-warning/50 text-warning" }, critical: { label: "ด่วนมาก", cls: "border-destructive/40 text-destructive" },
};

const EMPTY = { type: "new", title: "", detail: "", urgency: "normal", contact: "" };

/** popup ขอรายงานใหม่ / ขอแก้ไข / แจ้งตัวเลขผิดปกติ — เปิดได้จากแถบบนทุกหน้า และจากหน้าคำขอ */
export function RequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const path = usePathname();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(api("/requests"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error((await res?.json().catch(() => null))?.error || "ส่งไม่สำเร็จ"); return; }
    setForm({ ...EMPTY, contact: form.contact }); // จำเบอร์ไว้ใช้ครั้งถัดไป
    onOpenChange(false);
    if (path === "/requests") { toast.success("ส่งคำขอแล้ว"); router.refresh(); }
    else toast.success("ส่งคำขอแล้ว", { action: { label: "ดูคำขอของฉัน", onClick: () => router.push("/requests") } });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ขอรายงานใหม่ / ขอแก้ไข / แจ้งตัวเลขผิดปกติ</DialogTitle>
          <DialogDescription>ผู้ดูแลระบบจะรับเรื่องและแจ้งความคืบหน้าในหน้า “คำขอของฉัน”</DialogDescription>
        </DialogHeader>
        <form id="request-form" onSubmit={submit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>ประเภท</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(REQUEST_TYPE).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>ความเร่งด่วน</Label>
              <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(REQUEST_URGENCY).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="rq-title">ชื่อรายงาน *</Label><Input id="rq-title" autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น ผู้ป่วย CKD 4-5 ที่ยังไม่ได้ refer" /></div>
          <div className="space-y-1.5"><Label htmlFor="rq-detail">นิยาม / สูตรคำนวณ / เงื่อนไขที่ต้องการ</Label><Textarea id="rq-detail" rows={5} value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="rq-contact">เบอร์ติดต่อภายใน</Label><Input id="rq-contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
        </form>
        <DialogFooter className="items-center gap-2 sm:justify-between">
          {path !== "/requests" ? <Link href="/requests" onClick={() => onOpenChange(false)} className="text-sm text-primary hover:underline">ดูคำขอของฉัน</Link> : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>ยกเลิก</Button>
            <Button type="submit" form="request-form" disabled={busy || !form.title.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Send />} ส่งคำขอ</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
