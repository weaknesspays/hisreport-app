"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RequestDialog, REQUEST_TYPE as TYPE, REQUEST_URGENCY as URG } from "@/components/request-dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/config";
import { thaiDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { TablePager } from "@/components/ui/data-table";
import { useTable } from "@/lib/use-table";

export type RequestRow = { id: number; type: string; title: string; detail: string | null; urgency: string; status: string; contact: string | null; created_at: string; username: string; display_name: string; department: string | null };

const STEPS = [["submitted", "ส่งคำขอ"], ["accepted", "รับเรื่อง"], ["developing", "กำลังพัฒนา"], ["verifying", "ตรวจสอบตัวเลข"], ["published", "เผยแพร่แล้ว"]] as const;

export function RequestsView({ list, isAdmin }: { list: RequestRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const t = useTable(list, { pageSize: 10 });

  async function setStatus(id: number, status: string) {
    const res = await fetch(api("/requests"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }).catch(() => null);
    if (res?.ok) router.refresh(); else toast.error("ไม่สำเร็จ");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">{isAdmin ? "คำขอทั้งหมด" : "คำขอของฉัน"}</h1>
        <Button className="ml-auto" onClick={() => setOpen(true)}><Plus /> ส่งคำขอใหม่</Button>
      </div>
      <RequestDialog open={open} onOpenChange={setOpen} />
      <div className="space-y-3">
        {!list.length && (
          <Card className="items-center py-12 text-center">
            <ClipboardList className="size-10 text-muted-foreground" />
            <div className="font-medium">ยังไม่มีคำขอ</div>
            <p className="max-w-md text-sm text-muted-foreground">ต้องการรายงานใหม่ ขอแก้ไขรายงานเดิม หรือพบตัวเลขผิดปกติ กด “ส่งคำขอใหม่”</p>
            <Button variant="outline" onClick={() => setOpen(true)}><Plus /> ส่งคำขอใหม่</Button>
          </Card>
        )}
        {t.rows.map((r) => {
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
        <TablePager {...t} unit="คำขอ" setPageSize={t.setPageSize} pageSizes={[10, 25, 50]} />
      </div>
    </div>
  );
}
