"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, Play, Plus, Save, Send, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ParamForm } from "@/components/report/param-form";
import { ResultChart, ResultNumber, ResultTable } from "@/components/report/result-views";
import { ChartGuide, type ChartExample } from "@/components/admin/chart-guide";
import { api } from "@/lib/config";
import { defaultValues } from "@/lib/param-defaults";
import { thaiDate } from "@/lib/dates";
import { numericColumns } from "@/lib/format";
import {
  PARAM_TYPE_LABEL, VIEW_LABEL,
  type ColumnDef, type DisplayDef, type ParamDef, type ParamType, type ParamValues, type RunResult, type ViewType,
} from "@/lib/report-types";

export type EditorInitial = {
  id: number | null;
  status: "draft" | "published" | "disabled";
  publishedVersion: number | null;
  latestVersion: number;
  versions: { version: number; note: string | null; created_at: string; created_by: string | null }[];
  meta: {
    name: string; group_id: number | null; code: string; description: string; reference: string; tags: string;
    type: "system" | "custom"; has_person_data: boolean; cache_ttl: number; timeout_sec: number; row_limit: number;
  };
  sql: string;
  params: ParamDef[];
  columns: ColumnDef[];
  display: DisplayDef;
};

const TOKEN = /\{([A-Za-z_]\w*)(?:\.(start|end|end_next))?\}/g;
const FORMATS: { v: NonNullable<ColumnDef["format"]> | "auto"; label: string }[] = [
  { v: "auto", label: "อัตโนมัติ" }, { v: "text", label: "ข้อความ" }, { v: "number", label: "ตัวเลข 1,234" },
  { v: "decimal2", label: "ทศนิยม 2" }, { v: "percent", label: "ร้อยละ" }, { v: "date_th", label: "วันที่ไทย" }, { v: "datetime_th", label: "วันเวลาไทย" },
];
const PERSON_HINT = /(fname|lname|name|ชื่อ|pop_?id|cid|tel|phone|โทร|addr|ที่อยู่)/i;

function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ReportEditor({ initial, groups, isAdmin }: { initial: EditorInitial; groups: { id: number; name: string }[]; isAdmin: boolean }) {
  const router = useRouter();
  const [meta, setMeta] = useState(initial.meta);
  const [sql, setSql] = useState(initial.sql);
  const [params, setParams] = useState<ParamDef[]>(initial.params);
  const [columns, setColumns] = useState<ColumnDef[]>(initial.columns);
  const [display, setDisplay] = useState<DisplayDef>(initial.display);
  const [note, setNote] = useState("");
  const [tab, setTab] = useState("general");
  const [saving, setSaving] = useState(false);

  const [testValues, setTestValues] = useState<ParamValues>(() => defaultValues(initial.params));
  const [test, setTest] = useState<(RunResult & { compiledSql?: string }) | null>(null);
  const [testErr, setTestErr] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [preview, setPreview] = useState<ViewType>("table");

  // คอลัมน์ที่รู้จัก = จากผลทดสอบ + ที่ตั้งค่าไว้แล้ว
  const knownCols = useMemo(() => {
    const names = test ? test.columns : columns.map((c) => c.name);
    return names.map((n) => columns.find((c) => c.name === n) ?? { name: n });
  }, [test, columns]);
  const numericCols = useMemo(() => (test ? numericColumns(test.columns, test.rows) : []), [test]);

  function setCol(name: string, patch: Partial<ColumnDef>) {
    const base = knownCols.map((c) => ({ ...c }));
    const i = base.findIndex((c) => c.name === name);
    base[i] = { ...base[i], ...patch };
    setColumns(base);
  }

  function setParam(i: number, patch: Partial<ParamDef>) {
    setParams(params.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  /** คู่มือกราฟ: แทนที่ SQL + ตัวแปร และตั้งกราฟตามตัวอย่าง (ยังไม่บันทึก) */
  function applyChartExample(ex: ChartExample) {
    if (sql.trim() && !window.confirm("แทนที่ SQL และตัวแปรเดิมด้วยตัวอย่างนี้?")) return;
    setSql(ex.sql);
    setParams(ex.params);
    setTestValues(defaultValues(ex.params));
    setTest(null);
    const views = display.views.includes("chart") ? display.views : [...display.views, "chart" as ViewType];
    setDisplay({ ...display, views, defaultView: "chart", chart: ex.chart });
    toast.success("ใส่ตัวอย่างแล้ว — กด “ทดสอบ” เพื่อดูกราฟ แล้วบันทึก");
  }

  function pullParams() {
    const found = new Map<string, Set<string>>();
    for (const t of sql.matchAll(TOKEN)) {
      if (!found.has(t[1])) found.set(t[1], new Set());
      if (t[2]) found.get(t[1])!.add(t[2]);
    }
    const next = [...params];
    let added = 0;
    for (const [name, subs] of found) {
      if (next.some((p) => p.name === name)) continue;
      const type: ParamType = subs.size ? (/fy|fiscal/i.test(name) ? "fiscal_year" : "daterange") : /icd/i.test(name) ? "icd10" : "text";
      next.push({ name, label: name, type, required: !!subs.size, default: type === "daterange" ? "fy_start,today" : undefined });
      added++;
    }
    const unused = next.filter((p) => !found.has(p.name)).map((p) => p.name);
    setParams(next);
    setTestValues(defaultValues(next, testValues));
    toast.info(`เพิ่ม ${added} ตัวแปร${unused.length ? ` · ไม่ถูกใช้ใน SQL: ${unused.join(", ")}` : ""}`);
  }

  async function runTest() {
    setTesting(true); setTestErr(null);
    const res = await fetch(api("/admin/test"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params, values: testValues, timeoutSec: meta.timeout_sec }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setTesting(false);
    if (!res?.ok) { setTestErr(d?.error || "ทดสอบไม่สำเร็จ"); setTest(null); return; }
    setTest(d);
    // แนะนำคอลัมน์ข้อมูลส่วนบุคคลอัตโนมัติ (แก้ได้)
    const guessed = (d.columns as string[]).map((n) => columns.find((c) => c.name === n) ?? (PERSON_HINT.test(n) && !/icd/i.test(n) ? { name: n, person: true } : { name: n }));
    setColumns(guessed);
    if (guessed.some((c) => c.person)) setMeta((m) => ({ ...m, has_person_data: true }));
  }

  async function save(publish: boolean) {
    setSaving(true);
    const body = {
      meta: { ...meta, code: meta.code || null, description: meta.description || null, reference: meta.reference || null, tags: meta.tags || null },
      sql, params, columns: knownCols, display, note: note || undefined, publish,
    };
    const url = initial.id ? api(`/admin/reports/${initial.id}`) : api("/admin/reports");
    const res = await fetch(url, { method: initial.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setSaving(false);
    if (!res?.ok) { toast.error(d?.error || "บันทึกไม่สำเร็จ"); return; }
    if (d.warning) toast.warning(d.warning); else toast.success(publish ? `เผยแพร่ v${d.version} แล้ว` : "บันทึกร่างแล้ว");
    setNote("");
    if (!initial.id && d.id) {
      if (publish) await fetch(api(`/admin/reports/${d.id}`), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publishVersion: 1 }) });
      router.replace(`/admin/reports/${d.id}`);
    } else router.refresh();
  }

  async function patch(body: object, msg: string) {
    const res = await fetch(api(`/admin/reports/${initial.id}`), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (res?.ok) { toast.success(msg); router.refresh(); } else toast.error((await res?.json().catch(() => null))?.error || "ไม่สำเร็จ");
  }

  const toggleView = (v: ViewType, on: boolean) => {
    const views = on ? [...new Set([...display.views, v])] : display.views.filter((x) => x !== v);
    if (!views.length) return;
    setDisplay({ ...display, views, defaultView: views.includes(display.defaultView ?? "table") ? display.defaultView : views[0] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="icon" asChild><Link href="/admin/reports"><ArrowLeft /></Link></Button>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted-foreground">จัดการรายงาน › {initial.id ? `แก้ไข #${initial.id}` : "สร้างใหม่"}</div>
          <h1 className="truncate text-xl font-semibold">{meta.name || "รายงานใหม่"}</h1>
          <div className="mt-1 flex flex-wrap gap-1">
            {initial.publishedVersion && <Badge variant="outline" className="border-success/40 text-success">เผยแพร่ v{initial.publishedVersion}</Badge>}
            {initial.id && initial.latestVersion !== initial.publishedVersion && <Badge variant="outline" className="border-warning/50 text-warning">ร่าง v{initial.latestVersion}</Badge>}
            {initial.status === "disabled" && <Badge variant="outline">ปิดใช้งาน</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setTab("test"); runTest(); }} disabled={testing}>{testing ? <Loader2 className="animate-spin" /> : <Play />} ทดสอบ</Button>
          <Button variant="outline" onClick={() => save(false)} disabled={saving}><Save /> บันทึกร่าง</Button>
          {isAdmin && <Button onClick={() => save(true)} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Send />} เผยแพร่</Button>}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="general">1. ทั่วไป</TabsTrigger>
            <TabsTrigger value="sql">2. SQL และตัวแปร</TabsTrigger>
            <TabsTrigger value="test">3. ทดสอบ</TabsTrigger>
            <TabsTrigger value="columns">4. คอลัมน์</TabsTrigger>
            <TabsTrigger value="display">5. การแสดงผล</TabsTrigger>
            <TabsTrigger value="perf">6. ประสิทธิภาพ</TabsTrigger>
            {initial.id && <TabsTrigger value="history">7. ประวัติ</TabsTrigger>}
          </TabsList>
        </div>

        {/* 1. ทั่วไป */}
        <TabsContent value="general">
          <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <Field label="ชื่อรายงาน *" className="md:col-span-2"><Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} /></Field>
            <Field label="หัวข้อรายงาน">
              <Select value={meta.group_id ? String(meta.group_id) : ""} onValueChange={(v) => setMeta({ ...meta, group_id: Number(v) })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="เลือกหัวข้อ" /></SelectTrigger>
                <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="รหัสรายงาน"><Input value={meta.code} onChange={(e) => setMeta({ ...meta, code: e.target.value })} placeholder="เช่น OPD-ICD-RANGE" /></Field>
            <Field label="นิยาม / สูตรคำนวณ (แสดงให้ผู้ใช้อ่านใต้ชื่อรายงาน)" className="md:col-span-2">
              <Textarea rows={3} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
            </Field>
            <Field label="แหล่งอ้างอิง"><Input value={meta.reference} onChange={(e) => setMeta({ ...meta, reference: e.target.value })} /></Field>
            <Field label="คำค้น (คั่นด้วย ,)"><Input value={meta.tags} onChange={(e) => setMeta({ ...meta, tags: e.target.value })} /></Field>
            <Field label="ประเภท">
              <Select value={meta.type} onValueChange={(v) => setMeta({ ...meta, type: v as "system" | "custom" })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="system">รายงานกลาง (System)</SelectItem><SelectItem value="custom">รายงานเฉพาะหน่วยงาน (Custom)</SelectItem></SelectContent>
              </Select>
            </Field>
            <div className="flex items-center gap-3 self-end rounded-md border p-3">
              <Switch id="person" checked={meta.has_person_data} onCheckedChange={(v) => setMeta({ ...meta, has_person_data: v })} />
              <Label htmlFor="person" className="font-normal">มีข้อมูลส่วนบุคคล (บันทึก log ทุกครั้งที่เปิด/ส่งออก)</Label>
            </div>
            {initial.id && isAdmin && (
              <div className="flex flex-wrap gap-2 md:col-span-2">
                {initial.status !== "disabled"
                  ? <Button variant="outline" className="text-destructive" onClick={() => patch({ status: "disabled" }, "ปิดใช้งานแล้ว")}>ปิดใช้งานรายงาน</Button>
                  : <Button variant="outline" onClick={() => patch({ status: initial.publishedVersion ? "published" : "draft" }, "เปิดใช้งานแล้ว")}>เปิดใช้งานอีกครั้ง</Button>}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* 2. SQL และตัวแปร */}
        <TabsContent value="sql" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">คำสั่ง SQL <Badge variant="outline" className="ml-2">SELECT เท่านั้น · ฐาน HIS อ่านอย่างเดียว</Badge></CardTitle>
              <CardDescription className="leading-relaxed">
                <code>{"{ชื่อ}"}</code> แทนค่าแบบปลอดภัย (prepared statement) ·
                ช่วงวันที่: <code>{"{date.start}"}</code> <code>{"{date.end}"}</code> (วันสุดท้าย ใช้กับ BETWEEN) <code>{"{date.end_next}"}</code> (วันถัดไป ใช้กับ &lt;) ·
                <code>[[ … ]]</code> เงื่อนไขเสริม: ถ้าตัวแปรข้างในว่าง ระบบตัดทั้งบล็อก · ตัวแปรหลายค่าใช้ <code>IN ({"{clinic}"})</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea value={sql} onChange={(e) => setSql(e.target.value)} spellCheck={false}
                className="min-h-80 bg-slate-950 font-mono text-[13px] leading-relaxed text-slate-100 dark:bg-slate-950" />
            </CardContent>
          </Card>
          <ChartGuide onUse={applyChartExample} onGoDisplay={() => setTab("display")} />
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0">
              <CardTitle className="text-base">ตัวแปรเงื่อนไข</CardTitle>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={pullParams}><Wand2 /> ดึงตัวแปรจาก SQL</Button>
                <Button size="sm" variant="outline" onClick={() => setParams([...params, { name: `p${params.length + 1}`, label: "", type: "text" }])}><Plus /> เพิ่ม</Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>ชื่อ</TableHead><TableHead>ป้ายชื่อ</TableHead><TableHead>ชนิด</TableHead><TableHead>ค่าเริ่มต้น / ตัวเลือก</TableHead>
                  <TableHead className="text-center">บังคับ</TableHead><TableHead className="text-center">หลายค่า</TableHead><TableHead />
                </TableRow></TableHeader>
                <TableBody>
                  {params.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell><Input className="h-8 w-32 font-mono" value={p.name} onChange={(e) => setParam(i, { name: e.target.value })} /></TableCell>
                      <TableCell><Input className="h-8 w-40" value={p.label} onChange={(e) => setParam(i, { label: e.target.value })} /></TableCell>
                      <TableCell>
                        <Select value={p.type} onValueChange={(v) => setParam(i, { type: v as ParamType })}>
                          <SelectTrigger size="sm" className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.entries(PARAM_TYPE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="min-w-64">
                        {p.type === "select_sql" ? (
                          <Textarea rows={2} className="font-mono text-xs" placeholder="SELECT cln, namecln FROM cln" value={p.optionsSql ?? ""} onChange={(e) => setParam(i, { optionsSql: e.target.value })} />
                        ) : p.type === "select" ? (
                          <Textarea rows={2} className="text-xs" placeholder={"ค่า:ป้ายชื่อ ต่อบรรทัด เช่น\n1:ชาย\n2:หญิง"}
                            value={(p.options ?? []).map((o) => `${o.value}:${o.label}`).join("\n")}
                            onChange={(e) => setParam(i, { options: e.target.value.split("\n").filter(Boolean).map((l) => { const [v, ...rest] = l.split(":"); return { value: v.trim(), label: (rest.join(":") || v).trim() }; }) })} />
                        ) : (
                          <Input className="h-8" value={p.default ?? ""} onChange={(e) => setParam(i, { default: e.target.value || undefined })}
                            placeholder={p.type === "daterange" ? "fy_start,today" : p.type === "date" ? "today / -30d" : p.type === "fiscal_year" ? "ว่าง = ปีงบปัจจุบัน" : ""} />
                        )}
                      </TableCell>
                      <TableCell className="text-center"><Checkbox checked={!!p.required} onCheckedChange={(v) => setParam(i, { required: !!v })} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={!!p.multiple} disabled={["daterange", "date", "fiscal_year"].includes(p.type)} onCheckedChange={(v) => setParam(i, { multiple: !!v })} /></TableCell>
                      <TableCell><Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => setParams(params.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {!params.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">ไม่มีตัวแปร</TableCell></TableRow>}
                </TableBody>
              </Table>
              <p className="mt-2 text-xs text-muted-foreground">ค่าเริ่มต้นวันที่ใช้คำได้: <code>today</code>, <code>fy_start</code>, <code>fy_end</code>, <code>month_start</code>, <code>-30d</code> · ช่วงวันที่ใส่ 2 ค่าคั่น , เช่น <code>month_start,today</code></p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. ทดสอบ */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-4 pt-6">
              <div className="flex-1"><ParamForm reportId={0} defs={params} values={testValues} onChange={setTestValues} /></div>
              <Button onClick={runTest} disabled={testing}>{testing ? <Loader2 className="animate-spin" /> : <Play />} ทดสอบ</Button>
            </CardContent>
          </Card>
          {testErr && <Alert variant="destructive"><AlertDescription className="whitespace-pre-wrap">{testErr}</AlertDescription></Alert>}
          {test && (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0">
                <CardTitle className="text-base text-success">✓ รันสำเร็จ</CardTitle>
                <span className="text-sm text-muted-foreground">{test.rowCount} แถว{test.truncated ? " (แสดง 200)" : ""} · {(test.durationMs / 1000).toFixed(2)} วิ · คอลัมน์: {test.columns.join(", ")}</span>
                <Tabs value={preview} onValueChange={(v) => setPreview(v as ViewType)} className="ml-auto">
                  <TabsList>{display.views.map((v) => <TabsTrigger key={v} value={v}>{VIEW_LABEL[v]}</TabsTrigger>)}</TabsList>
                </Tabs>
              </CardHeader>
              <CardContent>
                {preview === "table" && <ResultTable result={test} columns={knownCols} display={display} />}
                {preview === "number" && <ResultNumber result={test} columns={knownCols} display={display} />}
                {preview === "chart" && <ResultChart result={test} columns={knownCols} display={display} />}
                {test.compiledSql && (
                  <details className="mt-4 text-xs">
                    <summary className="cursor-pointer text-muted-foreground">SQL ที่รันจริง</summary>
                    <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3">{test.compiledSql}</pre>
                  </details>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 4. คอลัมน์ */}
        <TabsContent value="columns">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">การจัดรูปแบบคอลัมน์</CardTitle>
              <CardDescription>{test ? "ได้จากผลทดสอบล่าสุด" : "กด “ทดสอบ” เพื่อดึงรายชื่อคอลัมน์จาก SQL"} · คอลัมน์ข้อมูลส่วนบุคคลจะถูกปิดบังสำหรับผู้ไม่มีสิทธิ์ (ทั้งบนจอและ Excel)</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>คอลัมน์ SQL</TableHead><TableHead>หัวตาราง</TableHead><TableHead>รูปแบบ</TableHead>
                  <TableHead className="text-center">ซ่อน</TableHead><TableHead>แถวรวม</TableHead><TableHead className="text-center">ข้อมูลบุคคล</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {knownCols.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell className="font-mono text-sm">{c.name}</TableCell>
                      <TableCell><Input className="h-8 w-44" value={c.label ?? ""} placeholder={c.name} onChange={(e) => setCol(c.name, { label: e.target.value || undefined })} /></TableCell>
                      <TableCell>
                        <Select value={c.format ?? "auto"} onValueChange={(v) => setCol(c.name, { format: v === "auto" ? undefined : (v as ColumnDef["format"]) })}>
                          <SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>{FORMATS.map((f) => <SelectItem key={f.v} value={f.v}>{f.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center"><Checkbox checked={!!c.hidden} onCheckedChange={(v) => setCol(c.name, { hidden: !!v })} /></TableCell>
                      <TableCell>
                        <Select value={c.total ?? "none"} onValueChange={(v) => setCol(c.name, { total: v === "none" ? null : (v as "sum" | "avg") })}>
                          <SelectTrigger size="sm" className="w-28"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="none">อัตโนมัติ</SelectItem><SelectItem value="sum">ผลรวม</SelectItem><SelectItem value="avg">เฉลี่ย</SelectItem></SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center"><Checkbox checked={!!c.person} onCheckedChange={(v) => setCol(c.name, { person: !!v })} /></TableCell>
                    </TableRow>
                  ))}
                  {!knownCols.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">ยังไม่มีข้อมูลคอลัมน์</TableCell></TableRow>}
                </TableBody>
              </Table>
              <p className="mt-2 text-xs text-muted-foreground">“จำนวนคน” (HN ไม่ซ้ำ) ห้ามใช้ผลรวมท้ายตาราง เพราะคนเดียวกันอาจอยู่หลายแถว</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. การแสดงผล */}
        <TabsContent value="display">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-base">รูปแบบที่ให้เลือก</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(["table", "number", "chart"] as ViewType[]).map((v) => (
                  <label key={v} className="flex items-center gap-2"><Checkbox checked={display.views.includes(v)} onCheckedChange={(c) => toggleView(v, !!c)} /> {VIEW_LABEL[v]}</label>
                ))}
                <Field label="มุมมองเริ่มต้น">
                  <Select value={display.defaultView ?? display.views[0]} onValueChange={(v) => setDisplay({ ...display, defaultView: v as ViewType })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{display.views.map((v) => <SelectItem key={v} value={v}>{VIEW_LABEL[v]}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={display.dashboard !== false} onCheckedChange={(c) => setDisplay({ ...display, dashboard: !!c })} /> ให้เลือกใส่ Dashboard ได้</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!display.table?.totalRow} onCheckedChange={(c) => setDisplay({ ...display, table: { ...display.table, totalRow: !!c } })} /> แถวรวมท้ายตาราง</label>
                <Field label="แถวต่อหน้า"><Input type="number" value={display.table?.pageSize ?? 50} onChange={(e) => setDisplay({ ...display, table: { ...display.table, pageSize: Number(e.target.value) || 50 } })} /></Field>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base"># ตัวเลข (KPI)</CardTitle><CardDescription>ว่าง = อัตโนมัติ (แถวเดียวแสดงทุกคอลัมน์ตัวเลข)</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <Field label="วิธีคำนวณ">
                  <Select value={display.number?.agg ?? "sum"} onValueChange={(v) => setDisplay({ ...display, number: { ...display.number, agg: v as "sum" | "count" | "first" } })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="sum">ผลรวมของคอลัมน์</SelectItem><SelectItem value="count">นับจำนวนแถว</SelectItem><SelectItem value="first">ค่าแถวแรก</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="คอลัมน์หลัก">
                  <Select value={display.number?.column ?? "__auto"} onValueChange={(v) => setDisplay({ ...display, number: { ...display.number, column: v === "__auto" ? undefined : v } })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="__auto">อัตโนมัติ</SelectItem>{knownCols.map((c) => <SelectItem key={c.name} value={c.name}>{c.label || c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="คอลัมน์รอง (แสดงใต้ตัวเลข)">
                  <Select value={display.number?.subColumn ?? "__none"} onValueChange={(v) => setDisplay({ ...display, number: { ...display.number, subColumn: v === "__none" ? undefined : v } })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="__none">ไม่มี</SelectItem>{knownCols.map((c) => <SelectItem key={c.name} value={c.name}>{c.label || c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">กราฟ</CardTitle><CardDescription>ว่าง = อัตโนมัติ (คอลัมน์ข้อความแรก × คอลัมน์ตัวเลข)</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <Field label="ชนิด">
                  <Select value={display.chart?.type ?? "__auto"} onValueChange={(v) => setDisplay({ ...display, chart: { ...display.chart, type: v === "__auto" ? undefined : (v as "bar" | "barh" | "line") } })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="__auto">อัตโนมัติ</SelectItem><SelectItem value="bar">แท่งแนวตั้ง</SelectItem><SelectItem value="barh">แท่งแนวนอน (อันดับ)</SelectItem><SelectItem value="line">เส้น (แนวโน้ม)</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="แกนหมวด (X)">
                  <Select value={display.chart?.x ?? "__auto"} onValueChange={(v) => setDisplay({ ...display, chart: { ...display.chart, x: v === "__auto" ? undefined : v } })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="__auto">อัตโนมัติ</SelectItem>{knownCols.map((c) => <SelectItem key={c.name} value={c.name}>{c.label || c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="ค่า (Y)">
                  <div className="flex flex-wrap gap-3">
                    {(numericCols.length ? numericCols : knownCols.map((c) => c.name)).map((n) => (
                      <label key={n} className="flex items-center gap-1.5 text-sm">
                        <Checkbox checked={!!display.chart?.y?.includes(n)} onCheckedChange={(c) => {
                          const y = new Set(display.chart?.y ?? []); if (c) y.add(n); else y.delete(n);
                          setDisplay({ ...display, chart: { ...display.chart, y: [...y] } });
                        }} /> {n}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="แกนขวา (หน่วยต่างกัน เช่น บาท)">
                  <Select value={display.chart?.y2 ?? "__none"} onValueChange={(v) => setDisplay({ ...display, chart: { ...display.chart, y2: v === "__none" ? undefined : v } })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="__none">ไม่ใช้</SelectItem>{(numericCols.length ? numericCols : knownCols.map((c) => c.name)).map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="ตัวเลขบนแท่ง/จุด">
                  <Select value={display.chart?.labels === undefined ? "__auto" : display.chart.labels ? "on" : "off"} onValueChange={(v) => setDisplay({ ...display, chart: { ...display.chart, labels: v === "__auto" ? undefined : v === "on" } })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="__auto">อัตโนมัติ (แสดงเมื่อไม่แน่นเกินไป)</SelectItem><SelectItem value="on">แสดงเสมอ</SelectItem><SelectItem value="off">ไม่แสดง</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="แสดงสูงสุด (แถว)"><Input type="number" value={display.chart?.limit ?? 20} onChange={(e) => setDisplay({ ...display, chart: { ...display.chart, limit: Number(e.target.value) || 20 } })} /></Field>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 6. ประสิทธิภาพ */}
        <TabsContent value="perf">
          <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-3">
            <Field label="เก็บผลไว้ (cache) วินาที" hint="0 = ดึงสดทุกครั้ง · 1800 = 30 นาที · 86400 = 1 วัน">
              <Input type="number" value={meta.cache_ttl} onChange={(e) => setMeta({ ...meta, cache_ttl: Number(e.target.value) })} />
            </Field>
            <Field label="เวลารันสูงสุด (วินาที)"><Input type="number" value={meta.timeout_sec} onChange={(e) => setMeta({ ...meta, timeout_sec: Number(e.target.value) })} /></Field>
            <Field label="จำนวนแถวสูงสุด"><Input type="number" value={meta.row_limit} onChange={(e) => setMeta({ ...meta, row_limit: Number(e.target.value) })} /></Field>
            {/date\s*\(\s*\w+\.\w+\s*\)\s*between/i.test(sql) && (
              <Alert className="md:col-span-3"><AlertDescription>
                SQL ใช้ <code>date(คอลัมน์) BETWEEN</code> ซึ่งทำให้ฐานข้อมูลใช้ index ไม่ได้ (ช้า) — แนะนำ <code>คอลัมน์ &gt;= {"{date.start}"} AND คอลัมน์ &lt; {"{date.end_next}"}</code>
              </AlertDescription></Alert>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* 7. ประวัติ */}
        {initial.id && (
          <TabsContent value="history">
            <Card><CardContent className="space-y-3 pt-6">
              <Field label="บันทึกการเปลี่ยนแปลงของการบันทึกครั้งนี้"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น เพิ่มเงื่อนไข sickdate" /></Field>
              <div className="divide-y rounded-md border">
                {initial.versions.map((v) => (
                  <div key={v.version} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                    <b>v{v.version}</b>
                    {v.version === initial.publishedVersion && <Badge variant="outline" className="border-success/40 text-success">เผยแพร่อยู่</Badge>}
                    <span className="text-muted-foreground">{v.created_by ?? "-"} · {thaiDate(v.created_at, true)}</span>
                    <span className="min-w-0 flex-1 truncate">{v.note}</span>
                    {isAdmin && v.version !== initial.publishedVersion && (
                      <Button size="sm" variant="outline" onClick={() => patch({ publishVersion: v.version }, `เผยแพร่ v${v.version} แล้ว`)}>เผยแพร่เวอร์ชันนี้</Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent></Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
