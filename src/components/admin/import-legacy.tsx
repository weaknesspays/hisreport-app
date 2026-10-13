"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Import, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/config";

type Preview = { total: number; imported: number };
type Result = { imported: number; skipped: number; disabled: number; warnings: string[] };

export function ImportLegacyButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"published" | "draft">("published");
  const [result, setResult] = useState<Result | null>(null);

  async function openDialog() {
    setOpen(true); setError(null); setResult(null); setPreview(null); setBusy(true);
    const res = await fetch(api("/admin/import-legacy")).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) setError(d?.error || "โหลดข้อมูลไม่สำเร็จ"); else setPreview(d);
  }

  async function run() {
    setBusy(true); setError(null);
    const res = await fetch(api("/admin/import-legacy"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setError(d?.error || "นำเข้าไม่สำเร็จ"); return; }
    setResult(d);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" onClick={openDialog}><Import /> นำเข้าจาก rep_query_item</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>นำเข้าคิวรี่เดิม</DialogTitle>
            <DialogDescription>อ่านจาก reportdb.rep_query_item (อ่านอย่างเดียว) — แปลง ? เป็นตัวแปรช่วงวันที่ให้อัตโนมัติ</DialogDescription>
          </DialogHeader>
          {busy && !preview && !result && <p className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> กำลังเชื่อมต่อ HIS…</p>}
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {preview && !result && (
            <div className="space-y-3 text-sm">
              <p>พบ <b>{preview.total}</b> รายการ · นำเข้าแล้ว {preview.imported} · จะนำเข้า <b>{preview.total - preview.imported}</b></p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>สร้างหัวข้อรายงานตาม item_id เดิม (เปลี่ยนชื่อได้ภายหลังที่เมนูหัวข้อรายงาน)</li>
                <li>level 4 (รายการที่เลิกใช้) → ปิดใช้งาน</li>
                <li>รายการที่จำนวน ? ไม่ตรงกับตัวแปร → นำเข้าเป็นร่าง ให้ตรวจก่อนเผยแพร่</li>
              </ul>
              <div className="space-y-1.5">
                <Label>สถานะของรายงานที่นำเข้า</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={status === "published" ? "default" : "outline"} onClick={() => setStatus("published")}>เผยแพร่ทันที (ใช้งานในระบบเดิมอยู่แล้ว)</Button>
                  <Button type="button" size="sm" variant={status === "draft" ? "default" : "outline"} onClick={() => setStatus("draft")}>เป็นร่าง</Button>
                </div>
                <p className="text-xs text-muted-foreground">ผู้ใช้ทั่วไปจะเห็นรายงานก็ต่อเมื่อ Role ของเขาเข้าถึงหัวข้อนั้น (กำหนดที่ ผู้ใช้และสิทธิ์)</p>
              </div>
            </div>
          )}
          {result && (
            <div className="space-y-2 text-sm">
              <p>นำเข้า <b>{result.imported}</b> รายงาน · ข้าม (มีอยู่แล้ว) {result.skipped} · ปิดใช้งาน {result.disabled}</p>
              {result.warnings.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md border p-2 text-xs text-muted-foreground">
                  {result.warnings.map((w) => <div key={w}>• {w}</div>)}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ปิด</Button>
            {preview && !result && <Button onClick={run} disabled={busy || preview.total === preview.imported}>{busy && <Loader2 className="animate-spin" />} นำเข้า</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
