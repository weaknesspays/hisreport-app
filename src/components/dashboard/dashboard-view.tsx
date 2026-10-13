"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Clock, Download, ExternalLink, Loader2, Play, Settings2, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResultChart, ResultNumber, ResultTable } from "@/components/report/result-views";
import { api } from "@/lib/config";
import { defaultValues } from "@/lib/param-defaults";
import { fiscalRange, fiscalYearOf, ymd } from "@/lib/dates";
import { VIEW_LABEL, type ParamValues, type RunResult, type ViewType } from "@/lib/report-types";
import type { WidgetData } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

type Pickable = { id: number; name: string; groupName: string | null; views: ViewType[] };
type Range = { start: string; end: string };

const WIDTH_CLASS = { quarter: "lg:col-span-1", half: "lg:col-span-2", full: "lg:col-span-4" };

/** ใช้ช่วงวันที่ของ dashboard กับตัวแปรวันที่ของแต่ละรายงาน */
function widgetValues(w: WidgetData, range: Range): ParamValues {
  const v = defaultValues(w.params);
  for (const p of w.params) {
    if (p.type === "daterange") v[p.name] = range;
    if (p.type === "fiscal_year") v[p.name] = String(fiscalYearOf(range.end));
    if (p.type === "date") v[p.name] = range.end;
  }
  return v;
}

type WState =
  | { s: "idle" }
  | { s: "queued"; pos: number }
  | { s: "running" }
  | { s: "done"; res: RunResult }
  | { s: "error"; err: string };

function Widget({ w, st }: { w: WidgetData; st: WState }) {
  const compactNumber = w.view === "number" && w.width === "quarter";
  const res = st.s === "done" ? st.res : null;
  return (
    <Card className={cn("col-span-1 gap-0 py-0 sm:col-span-2", WIDTH_CLASS[w.width], w.width === "quarter" && "sm:col-span-1")}>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b px-4 py-3">
        <CardTitle className="truncate text-sm font-semibold">{w.name}</CardTitle>
        {res && <span className="ml-auto shrink-0 text-xs text-muted-foreground" title={res.cached ? "ข้อมูลจาก cache" : "ดึงจาก HIS"}>
          {res.cached && "cache "}{new Date(res.generatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
        </span>}
        <Button variant="ghost" size="icon" className={cn("size-7", !res && "ml-auto")} asChild title="เปิดรายงาน"><Link href={`/reports/${w.reportId}`}><ExternalLink className="size-4" /></Link></Button>
      </CardHeader>
      <CardContent className={cn("p-4", compactNumber && "p-3")}>
        {st.s === "idle" && <p className="py-8 text-center text-sm text-muted-foreground">กด “แสดงผล” เพื่อประมวลผล</p>}
        {st.s === "queued" && <div className="flex h-28 items-center justify-center gap-2 rounded-md bg-muted/50 text-sm text-muted-foreground"><Clock className="size-4" /> รอคิว (ลำดับที่ {st.pos})</div>}
        {st.s === "running" && <div className="relative"><Skeleton className="h-28 w-full" /><span className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> กำลังประมวลผล…</span></div>}
        {st.s === "error" && <Alert variant="destructive"><AlertDescription>{st.err}</AlertDescription></Alert>}
        {res && (
          w.view === "chart" ? <ResultChart result={res} columns={w.columns} display={w.display} height={260} compact />
            : w.view === "number" ? <ResultNumber result={res} columns={w.columns} display={w.display} />
              : <ResultTable result={res} columns={w.columns} display={w.display} compact />
        )}
      </CardContent>
    </Card>
  );
}

function Picker({ open, onOpenChange, pickable, widgets }: { open: boolean; onOpenChange: (v: boolean) => void; pickable: Pickable[]; widgets: WidgetData[] }) {
  const router = useRouter();
  const [sel, setSel] = useState(() => new Map(widgets.map((w) => [w.reportId, { view: w.view, width: w.width }])));
  const [saving, setSaving] = useState(false);
  const groups = useMemo(() => {
    const m = new Map<string, Pickable[]>();
    for (const p of pickable) m.set(p.groupName ?? "อื่น ๆ", [...(m.get(p.groupName ?? "อื่น ๆ") ?? []), p]);
    return [...m.entries()];
  }, [pickable]);

  async function save() {
    setSaving(true);
    const order = [...sel.keys()];
    const res = await fetch(api("/dashboard"), {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgets: order.map((id) => ({ reportId: id, ...sel.get(id)! })) }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) { toast.error("บันทึกไม่สำเร็จ"); return; }
    onOpenChange(false);
    toast.success("บันทึก Dashboard แล้ว");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>เลือกรายงานที่แสดงบน Dashboard</DialogTitle></DialogHeader>
        {!pickable.length && <p className="text-muted-foreground">ยังไม่มีรายงานที่เผยแพร่ในหัวข้อที่คุณมีสิทธิ์</p>}
        <div className="space-y-4">
          {groups.map(([g, list]) => (
            <div key={g} className="space-y-1.5">
              <div className="text-sm font-semibold">{g}</div>
              {list.map((p) => {
                const cur = sel.get(p.id);
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                    <Checkbox id={`p${p.id}`} checked={!!cur} onCheckedChange={(c) => {
                      const m = new Map(sel);
                      if (c) m.set(p.id, { view: p.views.includes("chart") ? "chart" : p.views[0], width: "half" }); else m.delete(p.id);
                      setSel(m);
                    }} />
                    <Label htmlFor={`p${p.id}`} className="min-w-0 flex-1 cursor-pointer font-normal">{p.name}</Label>
                    {cur && <>
                      <Select value={cur.view} onValueChange={(v) => setSel(new Map(sel).set(p.id, { ...cur, view: v as ViewType }))}>
                        <SelectTrigger size="sm" className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>{p.views.map((v) => <SelectItem key={v} value={v}>{VIEW_LABEL[v]}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={cur.width} onValueChange={(v) => setSel(new Map(sel).set(p.id, { ...cur, width: v as WidgetData["width"] }))}>
                        <SelectTrigger size="sm" className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quarter">1/4 แถว</SelectItem>
                          <SelectItem value="half">ครึ่งแถว</SelectItem>
                          <SelectItem value="full">เต็มแถว</SelectItem>
                        </SelectContent>
                      </Select>
                    </>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="animate-spin" />} บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DashboardView({ name, widgets, pickable, canExport }: { name: string; widgets: WidgetData[]; pickable: Pickable[]; canExport: boolean }) {
  const today = ymd(new Date());
  const fy = fiscalYearOf(today);
  const [range, setRange] = useState<Range>({ start: fiscalRange(fy).start, end: today });
  const [picked, setPicked] = useState<string | null>(`ปีงบ ${fy}`); // ตรงกับช่วงเริ่มต้น
  const [states, setStates] = useState<Record<number, WState>>({});
  const [running, setRunning] = useState(false);
  const runId = useRef(0);
  const [picker, setPicker] = useState(false);
  const [exporting, setExporting] = useState(false);

  /** ประมวลผลทีละรายงาน (ไม่ยิงพร้อมกัน) เพื่อไม่เพิ่มภาระให้ HIS */
  async function runAll() {
    const id = ++runId.current;
    setRunning(true);
    setStates(Object.fromEntries(widgets.map((w, i) => [w.id, { s: "queued", pos: i + 1 } as WState])));
    for (const [i, w] of widgets.entries()) {
      if (runId.current !== id) return; // กดใหม่/ยกเลิก → หยุดรอบเก่า
      setStates((s) => {
        const n: Record<number, WState> = { ...s, [w.id]: { s: "running" } };
        widgets.slice(i + 1).forEach((x, j) => { n[x.id] = { s: "queued", pos: j + 1 }; });
        return n;
      });
      let next: WState;
      try {
        const r = await fetch(api(`/reports/${w.reportId}/run`), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values: widgetValues(w, range), silent: true }),
        });
        const d = await r.json();
        next = r.ok ? { s: "done", res: d } : { s: "error", err: d.error || "ผิดพลาด" };
      } catch {
        next = { s: "error", err: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" };
      }
      if (runId.current !== id) return;
      setStates((s) => ({ ...s, [w.id]: next }));
    }
    setRunning(false);
  }

  function stop() {
    runId.current++;
    setRunning(false);
    setStates((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.s === "queued" || v.s === "running" ? { s: "idle" } : v])));
  }

  const presets = [
    { label: "เดือนนี้", r: { start: today.slice(0, 8) + "01", end: today } },
    { label: `ปีงบ ${fy}`, r: { start: fiscalRange(fy).start, end: today } },
    ...Array.from({ length: 5 }, (_, i) => ({ label: `ปีงบ ${fy - 1 - i}`, r: fiscalRange(fy - 1 - i) })),
  ];
  // ช่วงเดียวกันอาจตรงหลายปุ่ม → ไฮไลต์ปุ่มที่กดล่าสุด หรือปุ่มแรกที่ตรง
  const matches = presets.filter((p) => range.start === p.r.start && range.end === p.r.end).map((p) => p.label);
  const activePreset = picked && matches.includes(picked) ? picked : matches[0];

  async function exportAll() {
    setExporting(true);
    const values = Object.fromEntries(widgets.map((w) => [String(w.id), widgetValues(w, range)]));
    const res = await fetch(api("/dashboard/export"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values }) }).catch(() => null);
    setExporting(false);
    if (!res?.ok) { toast.error("ส่งออกไม่สำเร็จ"); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await res.blob());
    a.download = `dashboard-${today}.xlsx`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">{name}</h1>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setPicker(true)}><Settings2 /> เลือกรายงาน</Button>
          {canExport && widgets.length > 0 && (
            <Button onClick={exportAll} disabled={exporting} className="bg-success text-white hover:bg-success/90">
              {exporting ? <Loader2 className="animate-spin" /> : <Download />} <span className="hidden sm:inline">Excel ทั้งหน้า</span>
            </Button>
          )}
        </div>
      </div>

      <Card className="py-4">
        <CardContent className="flex flex-wrap items-end gap-3 px-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ช่วงวันที่ (ใช้กับทุกรายงานบนหน้านี้)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="date" className="w-40" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} />
              <span className="text-muted-foreground">ถึง</span>
              <Input type="date" className="w-40" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {presets.map((p) => (
              <Button key={p.label} size="sm" variant={p.label === activePreset ? "default" : "outline"} className="h-8 rounded-full"
                onClick={() => { setPicked(p.label); setRange(p.r); }}>{p.label}</Button>
            ))}
          </div>
          {running
            ? <Button variant="outline" onClick={stop}><Square /> หยุด</Button>
            : <Button onClick={runAll} disabled={!widgets.length}><Play /> แสดงผล</Button>}
        </CardContent>
        {widgets.length > 1 && <p className="px-4 text-xs text-muted-foreground">ประมวลผลทีละรายงานตามลำดับ เพื่อไม่ให้ฐานข้อมูล HIS ทำงานหนักเกินไป</p>}
      </Card>

      {!widgets.length ? (
        <Card><CardContent className="py-14 text-center">
          <p className="mb-4 text-muted-foreground">ยังไม่ได้เลือกรายงานสำหรับ Dashboard</p>
          <Button onClick={() => setPicker(true)}><Settings2 /> เลือกรายงาน</Button>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {widgets.map((w) => <Widget key={`${w.id}-${w.view}-${w.width}`} w={w} st={states[w.id] ?? { s: "idle" }} />)}
        </div>
      )}
      {picker && <Picker open={picker} onOpenChange={setPicker} pickable={pickable} widgets={widgets} />}
    </div>
  );
}
