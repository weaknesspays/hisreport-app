"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/config";

type Named = { id: number; name: string; note?: string | null };

export function RenameDialog({ item, onClose }: { item: Named; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await fetch(api(`/saved/${item.id}`), {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, note: note || null }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error((await res?.json().catch(() => null))?.error || "บันทึกไม่สำเร็จ"); return; }
    toast.success("บันทึกแล้ว");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>เปลี่ยนชื่อแฟ้ม</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="rn-name">ชื่อแฟ้ม</Label><Input id="rn-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div className="space-y-1.5"><Label htmlFor="rn-note">หมายเหตุ</Label><Textarea id="rn-note" rows={2} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={save} disabled={busy || !name.trim()}>{busy && <Loader2 className="animate-spin" />} บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDialog({ items, busy, onClose, onConfirm }: { items: Named[]; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ลบ {items.length > 1 ? `${items.length} แฟ้ม` : "แฟ้ม"}?</DialogTitle>
          <DialogDescription>ข้อมูลที่บันทึกไว้จะถูกลบถาวร กู้คืนไม่ได้ (รายงานต้นฉบับไม่ได้รับผลกระทบ)</DialogDescription>
        </DialogHeader>
        <ul className="max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-sm">
          {items.map((i) => <li key={i.id}>{i.name}</li>)}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />} ลบถาวร</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
