"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Code2, Copy, ExternalLink, Loader2, Pencil, Save, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/config";
import { cn } from "@/lib/utils";

type V = { version: number; sql: string };

/**
 * ดู/แก้ SQL ของรายงานจากหน้ารายงาน (เฉพาะผู้ดูแลระบบ)
 * ดู = เวอร์ชันที่หน้านี้ใช้รัน · แก้ = เริ่มจากเวอร์ชันล่าสุด (ร่างที่ค้างอยู่ไม่หาย) → API ตรวจกับ HIS ก่อนบันทึก
 */
export function ReportSqlPanel({ reportId, viewed, latest, publishedVersion }: { reportId: number; viewed: V; latest: V; publishedVersion: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sql, setSql] = useState(latest.sql);
  const [busy, setBusy] = useState<null | "draft" | "publish">(null);
  const [err, setErr] = useState<string | null>(null);

  const viewedIsPublished = publishedVersion === viewed.version;
  const draftAhead = latest.version !== viewed.version;
  const changed = sql.replace(/\r\n/g, "\n").trim() !== latest.sql.replace(/\r\n/g, "\n").trim();

  async function copy() {
    try { await navigator.clipboard.writeText(viewed.sql); toast.success("คัดลอก SQL แล้ว"); } catch { toast.error("คัดลอกไม่สำเร็จ"); }
  }
  function startEdit() { setSql(latest.sql); setErr(null); setEditing(true); setOpen(true); }

  async function save(publish: boolean) {
    if (publish && !window.confirm("บันทึกและเผยแพร่ทันที? ผู้ใช้ทุกคนจะเห็น SQL ใหม่นี้")) return;
    setBusy(publish ? "publish" : "draft"); setErr(null);
    const res = await fetch(api(`/admin/reports/${reportId}/sql`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql, publish }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(null);
    if (!res?.ok) { setErr(d?.error || "บันทึกไม่สำเร็จ"); return; }
    toast.success(publish ? `เผยแพร่ v${d.version} แล้ว` : `บันทึกร่าง v${d.version} แล้ว — ยังไม่เผยแพร่`);
    setEditing(false);
    router.refresh();
  }

  return (
    <Card className="gap-0 py-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-muted/50">
        <Code2 className="size-4 text-primary" />
        <span className="font-medium">คำสั่ง SQL</span>
        <Badge variant="outline" className={viewedIsPublished ? "border-success/40 text-success" : "border-warning/50 text-warning"}>
          v{viewed.version} {viewedIsPublished ? "เผยแพร่" : "ร่าง"}
        </Badge>
        {draftAhead && <Badge variant="outline" className="border-warning/50 text-warning">มีร่าง v{latest.version} ยังไม่เผยแพร่</Badge>}
        <span className="text-xs text-muted-foreground">เฉพาะผู้ดูแลระบบ</span>
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-3 border-t p-4">
          {!editing ? (
            <>
              <pre className="max-h-96 overflow-auto rounded-md bg-slate-950 p-3 font-mono text-[12.5px] leading-relaxed text-slate-100">{viewed.sql}</pre>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={copy}><Copy /> คัดลอก</Button>
                <Button size="sm" onClick={startEdit}><Pencil /> แก้ไข SQL</Button>
                <Button size="sm" variant="ghost" asChild className="ml-auto"><Link href={`/admin/reports/${reportId}`}><ExternalLink /> เปิดตัวแก้ไขเต็ม (ตัวแปร/คอลัมน์/ทดสอบ)</Link></Button>
              </div>
            </>
          ) : (
            <>
              {draftAhead && <p className="text-xs text-warning">แก้ต่อจากร่างล่าสุด v{latest.version} (ยังไม่เผยแพร่) — ไม่ใช่ v{viewed.version} ที่หน้านี้ใช้อยู่</p>}
              <Textarea value={sql} onChange={(e) => setSql(e.target.value)} spellCheck={false} autoFocus
                className="min-h-72 bg-slate-950 font-mono text-[13px] leading-relaxed text-slate-100 dark:bg-slate-950" />
              <p className="text-xs text-muted-foreground">
                ใช้ตัวแปรเดิมของรายงานได้ เช่น <code>{"{date.start}"}</code> <code>{"{date.end_next}"}</code> · ถ้าต้องการตัวแปรใหม่ คอลัมน์ หรือการแสดงผล ให้ใช้ตัวแก้ไขเต็ม ·
                ระบบตรวจกับ HIS (EXPLAIN) ก่อนบันทึก{publishedVersion === latest.version && " · รายงานเผยแพร่แล้ว จะบันทึกเป็นเวอร์ชันใหม่ (ย้อนกลับได้ที่แท็บประวัติ)"}
              </p>
              {err && <Alert variant="destructive"><AlertDescription className="whitespace-pre-wrap break-words">{err}</AlertDescription></Alert>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); setErr(null); }} disabled={!!busy}><X /> ยกเลิก</Button>
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => save(false)} disabled={!!busy || !changed}>
                  {busy === "draft" ? <Loader2 className="animate-spin" /> : <Save />} บันทึกเป็นร่าง
                </Button>
                <Button size="sm" onClick={() => save(true)} disabled={!!busy || !changed}>
                  {busy === "publish" ? <Loader2 className="animate-spin" /> : <Send />} บันทึกและเผยแพร่
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
