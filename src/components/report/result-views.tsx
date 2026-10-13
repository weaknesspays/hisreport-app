"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, Info, ShieldAlert } from "lucide-react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCell, fmtNumber, isNumeric, numericColumns } from "@/lib/format";
import { analyzeResult, groupRows, metricLabel, type Metric } from "@/lib/chart-analysis";
import type { ColumnDef, DisplayDef, RunResult } from "@/lib/report-types";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function useCols(result: RunResult, columns: ColumnDef[]) {
  return useMemo(() => {
    const defs = new Map(columns.map((c) => [c.name, c]));
    const visible = result.columns.filter((c) => !defs.get(c)?.hidden);
    const numeric = new Set(numericColumns(result.columns, result.rows));
    return { defs, visible, numeric };
  }, [result, columns]);
}

export function ResultTable({ result, columns, display, compact = false }: { result: RunResult; columns: ColumnDef[]; display: DisplayDef; compact?: boolean }) {
  const { defs, visible, numeric } = useCols(result, columns);
  const ids = useMemo(() => new Set(analyzeResult(result, defs).ids.map((c) => c.name)), [result, defs]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
  const pageSize = compact ? 10 : display.table?.pageSize || 50;

  const filtered = useMemo(() => {
    let r = result.rows;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      r = r.filter((row) => visible.some((c) => String(row[c] ?? "").toLowerCase().includes(s)));
    }
    if (sort) {
      r = [...r].sort((a, b) => {
        const x = a[sort.col], y = b[sort.col];
        if (isNumeric(x) && isNumeric(y)) return (Number(x) - Number(y)) * sort.dir;
        return String(x ?? "").localeCompare(String(y ?? ""), "th") * sort.dir;
      });
    }
    return r;
  }, [result.rows, q, sort, visible]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = filtered.slice(cur * pageSize, cur * pageSize + pageSize);
  const totals = display.table?.totalRow
    ? visible.map((c) => {
        const t = defs.get(c)?.total ?? (numeric.has(c) && !ids.has(c) ? "sum" : null); // ไม่รวม HN/AN
        if (!t || !numeric.has(c)) return null;
        const vals = filtered.map((r) => Number(r[c])).filter((n) => !Number.isNaN(n));
        const sum = vals.reduce((a, b) => a + b, 0);
        return t === "avg" ? (vals.length ? sum / vals.length : 0) : sum;
      })
    : null;

  if (!result.rows.length) return <p className="py-10 text-center text-muted-foreground">ไม่พบข้อมูลตามเงื่อนไข</p>;

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="ค้นหาในตาราง" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="h-8 w-56" />
          <span className="text-sm text-muted-foreground">{fmtNumber(filtered.length)} แถว{result.truncated && ` (แสดง ${fmtNumber(result.rows.length)} จาก ${fmtNumber(result.rowCount)})`}</span>
          {result.masked.length > 0 && <span className="flex items-center gap-1 text-sm text-warning"><ShieldAlert className="size-4" /> ข้อมูลส่วนบุคคลถูกปิดบัง</span>}
        </div>
      )}
      <div className="overflow-x-auto rounded-md border border-grid">
        {/* เส้นตารางแบบ Excel: ทุกช่องมีกรอบ */}
        <Table className="border-collapse [&_td]:border [&_td]:border-grid [&_th]:border [&_th]:border-grid [&_tr]:border-0 [&_tr:first-child>*]:border-t-0 [&_tr>*:first-child]:border-l-0 [&_tr>*:last-child]:border-r-0 [&_tbody_tr:last-child>td]:border-b-0">
          <TableHeader>
            <TableRow>
              {visible.map((c) => (
                <TableHead key={c} className={cn("cursor-pointer select-none whitespace-nowrap", numeric.has(c) && "text-right")}
                  onClick={() => setSort((s) => (s?.col === c ? { col: c, dir: s.dir === 1 ? -1 : 1 } : { col: c, dir: numeric.has(c) ? -1 : 1 }))}>
                  {defs.get(c)?.label || c}{sort?.col === c ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.map((row, i) => (
              <TableRow key={i}>
                {visible.map((c) => (
                  <TableCell key={c} className={cn("whitespace-nowrap", numeric.has(c) && "text-right tabular-nums")}>{formatCell(row[c], defs.get(c), c)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {totals && (
            <TableFooter>
              <TableRow>
                {visible.map((c, i) => (
                  <TableCell key={c} className={cn("font-semibold", numeric.has(c) && "text-right tabular-nums")}>
                    {i === 0 && totals[0] === null ? "รวม" : totals[i] === null ? "" : fmtNumber(totals[i], Number.isInteger(totals[i]) ? 0 : 2)}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="icon" className="size-8" disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronLeft /></Button>
          <span>หน้า {cur + 1} / {pages}</span>
          <Button variant="outline" size="icon" className="size-8" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}><ChevronRight /></Button>
        </div>
      )}
    </div>
  );
}

export function ResultNumber({ result, columns, display }: { result: RunResult; columns: ColumnDef[]; display: DisplayDef }) {
  const { defs, numeric } = useCols(result, columns);
  const cfg = display.number;
  const cards: { label: string; value: number; sub?: string }[] = [];

  const agg = (col: string, how: "sum" | "count" | "first" = "sum") => {
    if (how === "count") return result.rowCount;
    if (how === "first") return Number(result.rows[0]?.[col] ?? 0);
    return result.rows.reduce((a, r) => a + (Number(r[col]) || 0), 0);
  };

  if (cfg?.column || cfg?.agg === "count") {
    const v = agg(cfg.column ?? "", cfg.agg);
    const sub = cfg.subColumn ? `${fmtNumber(agg(cfg.subColumn, cfg.agg === "count" ? "sum" : cfg.agg))} ${cfg.subLabel ?? defs.get(cfg.subColumn)?.label ?? cfg.subColumn}` : undefined;
    cards.push({ label: cfg.column ? defs.get(cfg.column)?.label || cfg.column : "จำนวนแถว", value: v, sub });
  } else if (result.rows.length === 1) {
    // แถวเดียว: แสดงทุกคอลัมน์ตัวเลขเป็นการ์ด
    for (const c of result.columns) if (numeric.has(c)) cards.push({ label: defs.get(c)?.label || c, value: Number(result.rows[0][c]) });
  } else {
    cards.push({ label: "จำนวนแถว", value: result.rowCount });
    for (const c of [...numeric].slice(0, 3)) cards.push({ label: `รวม ${defs.get(c)?.label || c}`, value: agg(c) });
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">{c.label}</div>
          <div className="mt-1 text-3xl font-bold tabular-nums">{fmtNumber(c.value, Number.isInteger(c.value) ? 0 : 2)}</div>
          {c.sub && <div className="text-sm text-muted-foreground">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

type Series = { key: string; label: string };
type ChartType = "bar" | "barh" | "line";

const fmtVal = (v: number) => fmtNumber(v, Number.isInteger(v) ? 0 : 2);

function ChartBody({ data, series, type, height }: { data: Record<string, unknown>[]; series: Series[]; type: ChartType; height: number }) {
  const tick = { fill: "var(--muted-foreground)", fontSize: 12 };
  const labels = series.length === 1 && data.length <= 25; // ค่ากำกับบนแท่ง เมื่อมีชุดเดียวและไม่แน่นเกินไป
  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
      <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} formatter={(v: number) => fmtVal(v)} />
      {series.length > 1 && <Legend />}
    </>
  );
  const longest = Math.max(...data.map((d) => String(d.__x).length));
  return (
    <div style={{ height: type === "barh" ? Math.max(height, data.length * 32 + 40) : height }} className="w-full">
      <ResponsiveContainer>
        {type === "line" ? (
          <LineChart data={data} margin={{ left: 8, right: 24, top: 16 }}>
            {common}
            <XAxis dataKey="__x" tick={tick} />
            <YAxis tick={tick} tickFormatter={(v) => fmtNumber(v)} allowDecimals={false} />
            {series.map((s, i) => (
              <Line key={s.key} dataKey={s.key} name={s.label} stroke={CHART_COLORS[i % 5]} strokeWidth={2.5} dot={{ r: 3 }}>
                {labels && <LabelList dataKey={s.key} position="top" formatter={fmtVal} fontSize={12} fill="var(--foreground)" />}
              </Line>
            ))}
          </LineChart>
        ) : type === "barh" ? (
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40 }}>
            {common}
            <XAxis type="number" tick={tick} tickFormatter={(v) => fmtNumber(v)} allowDecimals={false} />
            <YAxis type="category" dataKey="__x" tick={tick} width={Math.min(240, Math.max(80, longest * 7.5))} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={CHART_COLORS[i % 5]} radius={[0, 4, 4, 0]} maxBarSize={28}>
                {labels && <LabelList dataKey={s.key} position="right" formatter={fmtVal} fontSize={12} fill="var(--foreground)" />}
              </Bar>
            ))}
          </BarChart>
        ) : (
          <BarChart data={data} margin={{ left: 8, right: 16, top: 20 }}>
            {common}
            <XAxis dataKey="__x" tick={tick} />
            <YAxis tick={tick} tickFormatter={(v) => fmtNumber(v)} allowDecimals={false} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={CHART_COLORS[i % 5]} radius={[4, 4, 0, 0]} maxBarSize={64}>
                {labels && <LabelList dataKey={s.key} position="top" formatter={fmtVal} fontSize={12} fill="var(--foreground)" />}
              </Bar>
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function NoChart({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto my-8 max-w-xl rounded-lg border border-dashed p-5 text-center">
      <Info className="mx-auto mb-2 size-6 text-muted-foreground" />
      <div className="font-semibold">{title}</div>
      {children && <div className="mt-1.5 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

/**
 * กราฟ — ดูลักษณะข้อมูลก่อน (ดู lib/chart-analysis.ts)
 * 1. ผู้ดูแลกำหนดแกน/ค่าไว้ใน "การแสดงผล" → ใช้ตามนั้น
 * 2. ข้อมูลสรุปมาแล้ว (1 แถว = 1 หมวด) → กราฟตรง ๆ
 * 3. ข้อมูลรายการ (1 แถว = 1 ราย) → นับ/รวม แยกตามคอลัมน์ที่เลือก
 * 4. จัดกลุ่มไม่ได้ → บอกเหตุผล
 */
export function ResultChart({ result, columns, display, height = 340, compact = false }: { result: RunResult; columns: ColumnDef[]; display: DisplayDef; height?: number; compact?: boolean }) {
  const { defs } = useCols(result, columns);
  const cfg = display.chart ?? {};
  const a = useMemo(() => analyzeResult(result, defs), [result, defs]);
  const [dimName, setDimName] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("count");

  if (!result.rows.length) return <NoChart title="ไม่พบข้อมูลตามเงื่อนไข" />;

  const cfgY = (cfg.y ?? []).filter((c) => result.columns.includes(c));
  const note = (text: React.ReactNode) => !compact && <p className="mb-3 flex items-start gap-1.5 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" />{text}</p>;

  // ---- 1, 2: กราฟจากแถวตรง ๆ ----
  if (cfgY.length || a.mode === "summary") {
    if (!cfgY.length && result.rows.length === 1) {
      const row = result.rows[0];
      const data = a.measures.map((m) => ({ __x: m.label, value: Number(row[m.name]) || 0 }));
      if (data.length < 2) return <NoChart title="ผลลัพธ์มีค่าเดียว — ไม่มีอะไรให้เปรียบเทียบเป็นกราฟ">ดูที่มุมมอง “ตัวเลข” หรือ “ตาราง” แทน</NoChart>;
      return <>{note("ผลลัพธ์มีแถวเดียว จึงเปรียบเทียบคอลัมน์ตัวเลขแต่ละคอลัมน์")}<ChartBody data={data} series={[{ key: "value", label: "ค่า" }]} type="bar" height={height} /></>;
    }
    const x = cfg.x && result.columns.includes(cfg.x) ? cfg.x : a.x?.name ?? a.cols.find((c) => c.kind !== "measure")?.name ?? result.columns[0];
    const ys = cfgY.length ? cfgY : a.measures.filter((m) => m.name !== x).slice(0, 3).map((m) => m.name);
    const limit = cfg.limit ?? 20;
    const data = result.rows.slice(0, limit).map((r) => {
      const o: Record<string, unknown> = { __x: formatCell(r[x], defs.get(x), x) };
      for (const y of ys) o[y] = Number(r[y]) || 0;
      return o;
    });
    const type = cfg.type ?? (data.length > 8 || data.some((d) => String(d.__x).length > 14) ? "barh" : "bar");
    const lbl = (c: string) => defs.get(c)?.label || c;
    return (
      <>
        {note(<>ข้อมูลสรุปมาแล้ว — แกน: <b>{lbl(x)}</b> · ค่า: <b>{ys.map(lbl).join(", ")}</b>{result.rows.length > limit && ` · แสดง ${limit} แถวแรกจาก ${fmtNumber(result.rows.length)}`}</>)}
        <ChartBody data={data} series={ys.map((y) => ({ key: y, label: lbl(y) }))} type={type} height={height} />
      </>
    );
  }

  // ---- 4: จัดกลุ่มไม่ได้ ----
  if (!a.dims.length) {
    return (
      <NoChart title="ข้อมูลชุดนี้ทำเป็นกราฟไม่ได้">
        ผลลัพธ์เป็นรายการรายบุคคล/รายครั้ง (1 แถว = 1 รายการ) แต่ไม่มีคอลัมน์ที่ใช้จัดกลุ่มได้ —
        ทุกคอลัมน์เป็นรหัสประจำตัวหรือค่าที่แทบไม่ซ้ำกัน{a.ids.length > 0 && <> ({a.ids.map((c) => c.label).join(", ")})</>}
        <br />แนะนำ: ดูเป็นตาราง หรือให้ผู้ดูแลปรับ SQL ให้สรุปด้วย <code>GROUP BY</code>
      </NoChart>
    );
  }

  // ---- 3: ข้อมูลรายการ → นับ/รวม แยกตามคอลัมน์ ----
  const dim = a.dims.find((d) => d.name === dimName) ?? a.dims[0];
  const okMetric = metric === "count" || a.measures.some((m) => metric.endsWith(`:${m.name}`)) ? metric : "count";
  const { data, unit, others } = groupRows(result.rows, dim, okMetric);
  const type: ChartType = dim.kind === "date" ? (data.length > 15 ? "line" : "bar") : data.length > 6 || data.some((d) => d.__x.length > 14) ? "barh" : "bar";
  const mLabel = metricLabel(okMetric, a.cols);

  return (
    <>
      {!compact && (
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">แยกตาม</div>
            <Select value={dim.name} onValueChange={setDimName}>
              <SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {a.dims.map((d) => <SelectItem key={d.name} value={d.name}>{d.label} {d.kind === "date" ? "(ช่วงเวลา)" : `(${d.distinct} ค่า)`}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">ค่าที่แสดง</div>
            <Select value={okMetric} onValueChange={(v) => setMetric(v as Metric)}>
              <SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="count">นับจำนวนแถว</SelectItem>
                {a.measures.flatMap((m) => [
                  <SelectItem key={`sum:${m.name}`} value={`sum:${m.name}`}>ผลรวม {m.label}</SelectItem>,
                  <SelectItem key={`avg:${m.name}`} value={`avg:${m.name}`}>ค่าเฉลี่ย {m.label}</SelectItem>,
                ])}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {note(
        <span>
          ข้อมูลเป็นรายการ (1 แถว = 1 รายการ, {fmtNumber(result.rows.length)} แถว{result.truncated && ` จาก ${fmtNumber(result.rowCount)}`}) จึงแสดง <b>{mLabel}</b> แยกตาม <b>{dim.label}</b>
          {unit && ` (ราย${unit === "month" ? "เดือน" : "วัน"})`}{others > 0 && ` · รวม ${others} ค่าที่น้อยไว้ใน “อื่น ๆ”`}
          {a.ids.length > 0 && <> · ไม่นำ {a.ids.map((c) => c.label).join(", ")} มาคำนวณ เพราะเป็นรหัส/ข้อมูลประจำตัว</>}
        </span>,
      )}
      <ChartBody data={data} series={[{ key: "value", label: mLabel }]} type={type} height={height} />
    </>
  );
}
