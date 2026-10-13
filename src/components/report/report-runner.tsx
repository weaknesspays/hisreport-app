"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Download, FolderOpen, Hash, Loader2, Play, Printer, RefreshCw, Save, Share2, Table2 } from "lucide-react";
import { SaveResultDialog } from "./save-result-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ParamForm } from "./param-form";
import { ResultChart, ResultNumber, ResultTable } from "./result-views";
import { api } from "@/lib/config";
import { defaultValues } from "@/lib/param-defaults";
import type { ColumnDef, DisplayDef, ParamDef, ParamValues, RunResult, ViewType } from "@/lib/report-types";

const VIEW_ICON: Record<ViewType, React.ReactNode> = { table: <Table2 />, number: <Hash />, chart: <BarChart3 /> };
const VIEW_TEXT: Record<ViewType, string> = { table: "ตาราง", number: "ตัวเลข", chart: "กราฟ" };

export type RunnerProps = {
  reportId: number;
  reportName?: string;   // มีค่า = แสดงปุ่ม "บันทึกผล"
  savedCount?: number;   // จำนวนแฟ้มที่บันทึกไว้ของรายงานนี้
  params: ParamDef[];
  columns: ColumnDef[];
  display: DisplayDef;
  canExport: boolean;
  initialValues?: ParamValues | null;
  latest?: boolean;      // ทดสอบเวอร์ชันร่าง (หน้าแก้ไขรายงาน)
  autoRun?: boolean;     // ค่าเริ่มต้น false — ให้ผู้ใช้กด "ประมวลผล" เอง (ไม่ยิงคิวรี่หนักไปที่ HIS ทุกครั้งที่เปิดรายงาน)
};

function valuesFromUrl(defs: ParamDef[]): ParamValues | null {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  if (![...sp.keys()].length) return null;
  const out: ParamValues = {};
  for (const d of defs) {
    if (d.type === "daterange") {
      const s = sp.get(`${d.name}.start`), e = sp.get(`${d.name}.end`);
      if (s && e) out[d.name] = { start: s, end: e };
    } else if (sp.has(d.name)) {
      out[d.name] = d.multiple ? sp.getAll(d.name) : sp.get(d.name);
    }
  }
  return out;
}

function valuesToQuery(values: ParamValues) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) {
    if (v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else if (typeof v === "object") { sp.set(`${k}.start`, v.start); sp.set(`${k}.end`, v.end); }
    else sp.set(k, v);
  }
  return sp.toString();
}

export function ReportRunner({ reportId, reportName, savedCount = 0, params, columns, display, canExport, initialValues, latest = false, autoRun = false }: RunnerProps) {
  const [ranValues, setRanValues] = useState<ParamValues | null>(null); // เงื่อนไขของผลที่แสดงอยู่ (ใช้ตอนบันทึก)
  const [saveOpen, setSaveOpen] = useState(false);
  const views = display.views?.length ? display.views : (["table"] as ViewType[]);
  const [values, setValues] = useState<ParamValues>(() => defaultValues(params, initialValues));
  const [view, setView] = useState<ViewType>(display.defaultView && views.includes(display.defaultView) ? display.defaultView : views[0]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const run = useCallback(async (vals: ParamValues, refresh = false) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api(`/reports/${reportId}/run`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: vals, latest, refresh }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "ประมวลผลไม่สำเร็จ"); setResult(null); setRanValues(null); }
      else { setResult(data); setRanValues(data.values ?? vals); }
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  }, [reportId, latest]);

  useEffect(() => {
    const fromUrl = valuesFromUrl(params);
    const start = fromUrl ? defaultValues(params, { ...defaultValues(params, initialValues), ...fromUrl }) : values;
    if (fromUrl) setValues(start);
    if (autoRun && !params.some((p) => p.required && !p.default && p.type !== "daterange" && p.type !== "fiscal_year" && p.type !== "date")) run(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function exportExcel() {
    setExporting(true);
    try {
      const res = await fetch(api(`/reports/${reportId}/export`), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values }),
      });
      if (!res.ok) { toast.error((await res.json().catch(() => null))?.error || "ส่งออกไม่สำเร็จ"); return; }
      const blob = await res.blob();
      const name = decodeURIComponent((res.headers.get("Content-Disposition") || "").match(/filename\*=UTF-8''([^;]+)/)?.[1] || `report-${reportId}.xlsx`);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
  }

  function share() {
    const url = `${window.location.origin}${window.location.pathname}?${valuesToQuery(values)}`;
    navigator.clipboard?.writeText(url).then(() => toast.success("คัดลอกลิงก์รายงานพร้อมเงื่อนไขแล้ว"), () => toast.info(url));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="flex-1"><ParamForm reportId={reportId} defs={params} values={values} onChange={setValues} latest={latest} /></div>
          <Button onClick={() => run(values)} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Play />} ประมวลผล</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0 border-b pb-3">
          {views.length > 1 ? (
            <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
              <TabsList>{views.map((v) => <TabsTrigger key={v} value={v} className="gap-1.5 [&>svg]:size-4">{VIEW_ICON[v]} {VIEW_TEXT[v]}</TabsTrigger>)}</TabsList>
            </Tabs>
          ) : <span className="flex items-center gap-1.5 text-sm font-medium [&>svg]:size-4">{VIEW_ICON[views[0]]} {VIEW_TEXT[views[0]]}</span>}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {result && (
              <span className="mr-1 text-xs text-muted-foreground">
                {result.cached ? "ข้อมูลจาก cache " : ""}{new Date(result.generatedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })} · {(result.durationMs / 1000).toFixed(1)} วิ
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => run(values, true)} disabled={busy} title="ดึงข้อมูลใหม่จาก HIS"><RefreshCw /> <span className="hidden sm:inline">รีเฟรช</span></Button>
            <Button variant="ghost" size="sm" onClick={share}><Share2 /> <span className="hidden sm:inline">แชร์ลิงก์</span></Button>
            <Button variant="ghost" size="sm" onClick={() => window.print()}><Printer /> <span className="hidden sm:inline">พิมพ์</span></Button>
            {reportName && !latest && (
              <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)} disabled={!result || busy} title="เก็บผลชุดนี้ไว้เปิดดูภายหลังโดยไม่ต้องประมวลผลใหม่">
                <Save /> บันทึกผล
              </Button>
            )}
            {canExport && <Button size="sm" onClick={exportExcel} disabled={!result || exporting} className="bg-success text-white hover:bg-success/90">
              {exporting ? <Loader2 className="animate-spin" /> : <Download />} Excel
            </Button>}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
          {busy && !result && <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>}
          {!busy && !result && !error && <p className="py-10 text-center text-muted-foreground">เลือกเงื่อนไขแล้วกด “ประมวลผล”</p>}
          {result && (
            <div className={busy ? "pointer-events-none opacity-50" : ""}>
              {view === "table" && <ResultTable result={result} columns={columns} display={display} />}
              {view === "number" && <ResultNumber result={result} columns={columns} display={display} />}
              {view === "chart" && <ResultChart result={result} columns={columns} display={display} />}
            </div>
          )}
        </CardContent>
      </Card>
      {reportName && savedCount > 0 && (
        <p className="text-sm text-muted-foreground">
          <FolderOpen className="mr-1 inline size-4 align-[-3px]" />
          คุณบันทึกผลรายงานนี้ไว้ {savedCount} แฟ้ม — <Link href={`/saved?report=${reportId}`} className="text-primary hover:underline">เปิดดูแฟ้มที่บันทึกไว้</Link>
        </p>
      )}
      {saveOpen && result && ranValues && reportName && (
        <SaveResultDialog open={saveOpen} onOpenChange={setSaveOpen} reportId={reportId} reportName={reportName} params={params} values={ranValues} result={result} />
      )}
    </div>
  );
}
