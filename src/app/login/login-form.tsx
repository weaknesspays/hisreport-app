"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/config";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(api("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }),
    }).catch(() => null);
    if (res?.ok) {
      router.replace(next);
      router.refresh();
      return;
    }
    const data = await res?.json().catch(() => null);
    setError(data?.error || "เข้าสู่ระบบไม่สำเร็จ");
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-l-4 border-primary/30 border-l-primary bg-primary/8 px-3 py-2.5 text-[15px] font-semibold text-foreground">
        <KeyRound className="size-5 shrink-0 text-primary" />
        <span className="leading-snug">ใช้ชื่อผู้ใช้และรหัสผ่าน<br /><span className="text-primary">เดียวกับโปรแกรม HIS</span></span>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="username" className="text-[13px] font-normal text-muted-foreground">ชื่อผู้ใช้ HIS</Label>
        <Input id="username" name="username" autoComplete="username" autoFocus required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-[13px] font-normal text-muted-foreground">รหัสผ่าน</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button type="submit" className="mt-3 w-full" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <LogIn />} เข้าสู่ระบบ
      </Button>
    </form>
  );
}
