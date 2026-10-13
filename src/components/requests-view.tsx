"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/config";
import { thaiDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type RequestRow = { id: number; type: string; title: string; detail: string | null; urgency: string; status: string; contact: string | null; created_at: string; username: string; display_name: string; department: string | null };

const STEPS = [["submitted", "ส่งคำขอ"], ["accepted", "รับเรื่อง"], ["developing", "กำลังพัฒนา"], ["verifying", "ตรวจสอบตัวเลข"], ["published", "เผยแพร่แล้ว"]] as const;
const TYPE: Record<string, string> = { new: "รายงานใหม่", change: "แก้ไขรายงานเดิม", data_issue: "แจ้งตัวเลขผิดปกติ" };
const URG: Record<string, { label: string; cls: string }> = {
  normal: { label: "ปกติ", cls: "" }, urgent: { label: "ด่วน", cls: "border-warning/50 text-warning" }, critical: { label: "ด่วนมาก", cls: "border-destructive/40 text-destructive" },
};

export function RequestsView({ list, isAdmin }: { list: RequestRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ type: "new", title: "", detail: "", urgency: "normal", contact: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(api("/requests"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error((await res?.json().catch(() => null))?.error || "ส่งไม่สำเร็จ"); return; }
    toast.success("ส่งคำขอแล้ว");
    setForm({ ...form, title: "", detail: "" });
    router.refresh();
  }

  async function setStatus(id: number, status: string) {
    const res = await fetch(api("/requests"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }).catch(() => null);
    if (res?.ok) router.refresh(); else toast.error("ไม่สำเร็จ");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_1fr]">
      <Card className="h-fit">
        <CardHeader><CardTitle className="text-base">ขอรายงานใหม่ / ขอแก้ไข / แจ้งตัวเลขผิดปกติ</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>ประเภท</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>ความเร่งด่วน</Label>
                <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(URG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>ชื่อรายงาน *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น ผู้ป่วย CKD 4-5 ที่ยังไม่ได้ refer" /></div>
            <div className="space-y-1.5"><Label>นิยาม / สูตรคำนวณ / เงื่อนไขที่ต้องการ</Label><Textarea rows={5} value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>เบอร์ติดต่อภายใน</Label><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
            <Button type="submit" disabled={busy || !form.title.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Send />} ส่งคำขอ</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{isAdmin ? "คำขอทั้งหมด" : "คำขอของฉัน"}</h2>
        {!list.length && <p className="text-muted-foreground">ยังไม่มีคำขอ</p>}
        {list.map((r) => {
          const idx = STEPS.findIndex(([k]) => k === r.status);
          return (
            <Card key={r.id} className="py-0">
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{r.title}</b>
                  <Badge variant="outline">{TYPE[r.type]}</Badge>
                  <Badge variant="outline" className={URG[r.urgency]?.cls}>{URG[r.urgency]?.label}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">{r.display_name} · {r.department} · {thaiDate(r.created_at, true)}</span>
                </div>
                {r.detail && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.detail}</p>}
                {r.status === "rejected" ? <Badge variant="outline" className="border-destructive/40 text-destructive">ปฏิเสธ</Badge> : (
                  <div className="flex flex-wrap gap-1">
                    {STEPS.map(([k, label], i) => (
                      <span key={k} className={cn("rounded-full px-2.5 py-0.5 text-xs", i < idx ? "bg-success/15 text-success" : i === idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{label}</span>
                    ))}
                  </div>
                )}
                {isAdmin && (
                  <Select value={r.status} onValueChange={(v) => setStatus(r.id, v)}>
                    <SelectTrigger size="sm" className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>{[...STEPS, ["rejected", "ปฏิเสธ"] as const].map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
