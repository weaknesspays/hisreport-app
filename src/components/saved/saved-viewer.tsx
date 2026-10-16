"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Code2, Download, FolderOpen, Hash, History, Loader2, Pencil, Play, Table2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ResultChart, ResultNumber, ResultTable } from "@/components/report/result-views";
import { RenameDialog, DeleteDialog } from "./saved-dialogs";
import { api } from "@/lib/config";
import { thaiDate } from "@/lib/dates";
import { describeValues, fmtNumber } from "@/lib/format";
import type { ColumnDef, DisplayDef, ParamDef, ParamValues, RunResult, ViewType } from "@/lib/report-types";

const VIEW_ICON: Record<ViewType, React.ReactNode> = { table: <Table2 />, number: <Hash />, chart: <BarChart3 /> };
const VIEW_TEXT: Record<ViewType, string> = { table: "ตาราง", number: "ตัวเลข", chart: "กราฟ" };

type Saved = {
  id: number; report_id: number | null; report_version: number; name: string; note: string | null; report_name: string;
  values: ParamValues; params: ParamDef[]; row_count: number; has_person_data: boolean; generated_at: string; created_at: string;
  current_version: number | null; reportExists: boolean; columns: ColumnDef[]; display: DisplayDef; result: RunResult; sql: string | null;
};

/** ค่าเงื่อนไข → query string ของหน้ารายงาน (ปุ่ม "ประมวลผลใหม่ด้วยเงื่อนไขเดิม") */
function toQuery(values: ParamValues) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) {
    if (v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else if (typeof v === "object") { sp.set(`${k}.start`, v.start); sp.set(`${k}.end`, v.end); }
    else sp.set(k, v);
  }
  return sp.toString();
}

export function SavedViewer({ saved: s, canExport }: { saved: Saved; canExport: boolean }) {
  const router = useRouter();
  const views = s.display.views?.length ? s.display.views : (["table"] as ViewType[]);
  const [view, setView] = useState<ViewType>(s.display.defaultView && views.includes(s.display.defaultView) ? s.display.defaultView : views[0]);
  const [rename, setRename] = useState(false);
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const conditions = describeValues(s.values, new Map(s.params.map((p) => [p.name, p.label])));
  const changed = s.current_version !== null && s.current_version !== s.report_version;

  async function doDelete() {
    setBusy(true);
    const res = await fetch(api(`/saved/${s.id}`), { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error("ลบไม่สำเร็จ"); return; }
    toast.success("ลบแฟ้มแล้ว");
    router.replace("/saved");
    router.refresh();
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const res = await fetch(api(`/saved/${s.id}/export`));
      if (!res.ok) { toast.error((await res.json().catch(() => null))?.error || "ส่งออกไม่สำเร็จ"); return; }
      const name = decodeURIComponent((res.headers.get("Content-Disposition") || "").match(/filename\*=UTF-8''([^;]+)/)?.[1] || `saved-${s.id}.xlsx`);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await res.blob());
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/saved" className="text-sm text-muted-foreground hover:underline"><FolderOpen className="mr-1 inline size-4 align-[-3px]" />แฟ้มที่บันทึกไว้</Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold sm:text-2xl">{s.name}</h1>
          <Button variant="ghost" size="sm" onClick={() => setRename(true)}><Pencil /> เปลี่ยนชื่อ</Button>
          {s.has_person_data && <Badge variant="outline" className="border-destructive/40 text-destructive">ข้อมูลส่วนบุคคล</Badge>}
        </div>
        {s.note && <p className="mt-1 text-sm italic text-muted-foreground">{s.note}</p>}
      </div>

      <Alert className="border-l-4 border-l-primary">
        <History className="size-4" />
        <AlertDescription className="text-foreground">
          <div><b>ข้อมูลที่บันทึกไว้ ณ {thaiDate(s.generated_at, true)} น.</b> — ไม่ใช่ข้อมูลล่าสุด (ไม่ได้ดึงจาก HIS ใหม่)</div>
          <div className="text-muted-foreground">
            รายงาน: {s.reportExists ? <Link href={`/reports/${s.report_id}`} className="text-primary hover:underline">{s.report_name}</Link> : s.report_name} (v{s.report_version})
            {" · "}เงื่อนไข: {conditions || "-"}{" · "}{fmtNumber(s.row_count)} แถว
          </div>
          {!s.reportExists && <div className="text-warning">รายงานต้นทางถูกลบแล้ว — แฟ้มนี้ยังเปิดดูได้ แต่ประมวลผลใหม่ไม่ได้</div>}
          {changed && <div className="text-warning">รายงานถูกแก้ไขหลังบันทึก (v{s.report_version} → v{s.current_version}) — ถ้าประมวลผลใหม่ ตัวเลขอาจต่างจากแฟ้มนี้</div>}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0 border-b pb-3">
          {views.length > 1 ? (
            <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
              <TabsList>{views.map((v) => <TabsTrigger key={v} value={v} className="gap-1.5 [&>svg]:size-4">{VIEW_ICON[v]} {VIEW_TEXT[v]}</TabsTrigger>)}</TabsList>
            </Tabs>
          ) : <span className="flex items-center gap-1.5 text-sm font-medium [&>svg]:size-4">{VIEW_ICON[views[0]]} {VIEW_TEXT[views[0]]}</span>}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {s.reportExists && (
              <Button variant="ghost" size="sm" asChild title="เปิดหน้ารายงานพร้อมเติมเงื่อนไขเดิม แล้วกดประมวลผลเพื่อดึงข้อมูลล่าสุด">
                <Link href={`/reports/${s.report_id}?${toQuery(s.values)}`}><Play /> ประมวลผลใหม่ด้วยเงื่อนไขเดิม</Link>
              </Button>
            )}
            {s.sql && <Button variant="ghost" size="sm" onClick={() => setShowSql((v) => !v)}><Code2 /> SQL</Button>}
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDel(true)}><Trash2 /> ลบ</Button>
            {canExport && (
              <Button size="sm" onClick={exportExcel} disabled={exporting || !s.result.rows.length} title={s.result.rows.length ? "ส่งออก Excel" : "ไม่มีข้อมูลให้ส่งออก"} className="bg-success text-white hover:bg-success/90">
                {exporting ? <Loader2 className="animate-spin" /> : <Download />} Excel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {showSql && s.sql && <pre className="mb-4 max-h-80 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">{s.sql}</pre>}
          {view === "table" && <ResultTable result={s.result} columns={s.columns} display={s.display} />}
          {view === "number" && <ResultNumber result={s.result} columns={s.columns} display={s.display} />}
          {view === "chart" && <ResultChart result={s.result} columns={s.columns} display={s.display} />}
        </CardContent>
      </Card>

      {rename && <RenameDialog item={s} onClose={() => setRename(false)} />}
      {del && <DeleteDialog items={[s]} busy={busy} onClose={() => setDel(false)} onConfirm={doDelete} />}
    </div>
  );
}
