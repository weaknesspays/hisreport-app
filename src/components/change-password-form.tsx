"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/config";
import { cn } from "@/lib/utils";

/** กฎเดียวกับ passwordProblem() ฝั่ง server (แสดงให้เห็นระหว่างพิมพ์) */
function rules(pw: string, username: string) {
  return [
    { ok: pw.length >= 8, label: "อย่างน้อย 8 ตัวอักษร" },
    { ok: /[A-Za-z฀-๿]/.test(pw) && /\d/.test(pw), label: "มีทั้งตัวอักษรและตัวเลข" },
    { ok: !!pw && !pw.toLowerCase().includes(username.toLowerCase()), label: "ไม่มีชื่อผู้ใช้อยู่ในรหัส" },
  ];
}

/** เปลี่ยนรหัสผ่านบัญชีในระบบ (local) — after: ไปหน้าไหนต่อเมื่อสำเร็จ (ไม่ระบุ = อยู่หน้าเดิม) */
export function ChangePasswordForm({ username, after }: { username: string; after?: string }) {
  const router = useRouter();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const checks = rules(f.next, username);
  const match = !!f.confirm && f.next === f.confirm;
  const ready = !!f.current && checks.every((c) => c.ok) && match;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true); setErr(null);
    const res = await fetch(api("/me/password"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: f.current, next: f.next }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setErr(d?.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ"); return; }
    toast.success("เปลี่ยนรหัสผ่านแล้ว");
    setF({ current: "", next: "", confirm: "" });
    if (after) { router.replace(after); router.refresh(); } else router.refresh();
  }

  const type = show ? "text" : "password";
  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="space-y-1.5"><Label htmlFor="pw-current">รหัสผ่านปัจจุบัน</Label>
        <Input id="pw-current" type={type} autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} autoFocus />
      </div>
      <div className="space-y-1.5"><Label htmlFor="pw-next">รหัสผ่านใหม่</Label>
        <div className="relative">
          <Input id="pw-next" type={type} autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} className="pr-9" />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
        </div>
        <ul className="space-y-0.5 text-xs">
          {checks.map((c) => (
            <li key={c.label} className={cn("flex items-center gap-1.5", !f.next ? "text-muted-foreground" : c.ok ? "text-success" : "text-destructive")}>
              {c.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />} {c.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-1.5"><Label htmlFor="pw-confirm">ยืนยันรหัสผ่านใหม่</Label>
        <Input id="pw-confirm" type={type} autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
        {!!f.confirm && !match && <p className="text-xs text-destructive">รหัสผ่านไม่ตรงกัน</p>}
      </div>
      {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
      <Button type="submit" disabled={!ready || busy}>{busy && <Loader2 className="animate-spin" />} เปลี่ยนรหัสผ่าน</Button>
    </form>
  );
}
