"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Check, ChevronsUpDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { addDays, fiscalRange, fiscalYearOf, ymd } from "@/lib/dates";
import { api } from "@/lib/config";
import type { ParamDef, ParamValue, ParamValues } from "@/lib/report-types";
import { cn } from "@/lib/utils";
import { Icd10Multi, Icd10Single, fmtIcd } from "./icd10-input";

function presets(today = ymd(new Date())) {
  const [y, m] = today.split("-").map(Number);
  const monthStart = today.slice(0, 8) + "01";
  const prevMonthEnd = addDays(monthStart, -1);
  const prevMonthStart = prevMonthEnd.slice(0, 8) + "01";
  const qStartMonth = [10, 11, 12].includes(m) ? 10 : m <= 3 ? 1 : m <= 6 ? 4 : 7;
  const qStart = `${y}-${String(qStartMonth).padStart(2, "0")}-01`;
  const fy = fiscalYearOf(today);
  const cur = fiscalRange(fy);
  return [
    { label: "วันนี้", start: today, end: today },
    { label: "เดือนนี้", start: monthStart, end: today },
    { label: "เดือนก่อน", start: prevMonthStart, end: prevMonthEnd },
    { label: "ไตรมาสนี้", start: qStart, end: today },
    { label: `ปีงบ ${fy}`, start: cur.start, end: today },
    ...Array.from({ length: FY_BACK }, (_, i) => {
      const r = fiscalRange(fy - 1 - i);
      return { label: `ปีงบ ${fy - 1 - i}`, start: r.start, end: r.end };
    }),
  ];
}

/** จำนวนปีงบย้อนหลังที่ให้เลือก (ไม่รวมปีปัจจุบัน) */
const FY_BACK = 5;

function useOptions(reportId: number, def: ParamDef, latest: boolean) {
  const [opts, setOpts] = useState(def.options ?? []);
  useEffect(() => {
    if (def.type !== "select_sql") return;
    let alive = true;
    // reportId = 0 → หน้าแก้ไขรายงาน: โหลดจากนิยามตัวแปรที่ยังไม่บันทึก
    const req = reportId === 0
      ? fetch(api("/admin/test"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ params: [def], optionsFor: def.name }) })
      : fetch(api(`/reports/${reportId}/options?param=${encodeURIComponent(def.name)}${latest ? "&latest=1" : ""}`));
    req.then((r) => r.json()).then((d) => { if (alive && d.options) setOpts(d.options); }).catch(() => {});
    return () => { alive = false; };
  }, [reportId, def, latest]);
  return opts;
}

function MultiSelect({ options, value, onChange, placeholder }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const label = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-auto min-h-9 w-full min-w-56 justify-between font-normal">
          <span className="flex flex-wrap gap-1">
            {value.length ? value.map((v) => (
              <Badge key={v} variant="secondary" className="gap-1">
                {label(v)}
                <X className="size-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== v)); }} />
              </Badge>
            )) : <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="ค้นหา…" />
          <CommandList>
            <CommandEmpty>ไม่พบ</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const on = value.includes(o.value);
                return (
                  <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}>
                    <Check className={cn("size-4", on ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{o.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{o.value}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function Field({ reportId, def, value, onChange, latest }: { reportId: number; def: ParamDef; value: ParamValue; onChange: (v: ParamValue) => void; latest: boolean }) {
  const opts = useOptions(reportId, def, latest);
  const [picked, setPicked] = useState<string | null>(null);
  const label = <Label className="text-xs text-muted-foreground">{def.label}{def.required && <span className="text-destructive"> *</span>}</Label>;

  if (def.type === "daterange") {
    const v = (value && typeof value === "object" && !Array.isArray(value) ? value : { start: "", end: "" });
    // ช่วงเดียวกันอาจตรงหลายปุ่ม (ต้นเดือน ต.ค. = เดือนนี้ = ไตรมาสนี้ = ปีงบนี้) → ไฮไลต์ปุ่มที่กดล่าสุด หรือปุ่มแรกที่ตรง
    const list = presets();
    const matches = list.filter((p) => v.start === p.start && v.end === p.end).map((p) => p.label);
    const active = picked && matches.includes(picked) ? picked : matches[0];
    return (
      <div className="space-y-1.5">
        {label}
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" className="w-40" value={v.start} onChange={(e) => onChange({ ...v, start: e.target.value })} />
          <span className="text-muted-foreground">ถึง</span>
          <Input type="date" className="w-40" value={v.end} onChange={(e) => onChange({ ...v, end: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-1">
          {list.map((p) => (
            <Button key={p.label} type="button" size="sm" variant={p.label === active ? "default" : "outline"} className="h-7 rounded-full px-2.5 text-xs"
              onClick={() => { setPicked(p.label); onChange({ start: p.start, end: p.end }); }}>{p.label}</Button>
          ))}
        </div>
      </div>
    );
  }
  if (def.type === "date") {
    return <div className="space-y-1.5">{label}<Input type="date" className="w-40" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} /></div>;
  }
  if (def.type === "fiscal_year") {
    const fy = fiscalYearOf(ymd(new Date()));
    return (
      <div className="space-y-1.5">{label}
        <Select value={String(value ?? fy)} onValueChange={onChange}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{Array.from({ length: FY_BACK * 2 + 1 }, (_, i) => String(fy - i)).map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    );
  }
  if (def.type === "select" || def.type === "select_sql") {
    if (def.multiple) {
      return <div className="space-y-1.5">{label}<MultiSelect options={opts} value={Array.isArray(value) ? value : []} onChange={onChange} placeholder={def.required ? "เลือก…" : "ทั้งหมด (ไม่กรอง)"} /></div>;
    }
    return (
      <div className="space-y-1.5">{label}
        <Select value={String(value ?? "")} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
          <SelectTrigger className="min-w-48"><SelectValue placeholder={def.required ? "เลือก…" : "ทั้งหมด"} /></SelectTrigger>
          <SelectContent>
            {!def.required && <SelectItem value="__all">ทั้งหมด</SelectItem>}
            {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (def.type === "icd10") {
    return (
      <div className="space-y-1.5">{label}
        {def.multiple
          ? <Icd10Multi ariaLabel={def.label} value={Array.isArray(value) ? value : value ? [String(value)] : []} onChange={onChange} />
          : <Icd10Single ariaLabel={def.label} value={Array.isArray(value) ? value[0] ?? "" : String(value ?? "")} onChange={onChange} />}
      </div>
    );
  }
  // text / number — หลายค่าคั่นด้วย ,
  const text = Array.isArray(value) ? value.join(",") : String(value ?? "");
  return (
    <div className="space-y-1.5">{label}
      <Input
        className="w-44"
        inputMode={def.type === "number" ? "decimal" : undefined}
        placeholder={def.multiple ? "คั่นหลายค่าด้วย ," : ""}
        value={text}
        onChange={(e) => onChange(def.multiple ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : e.target.value)}
      />
    </div>
  );
}

/** ป้ายร่วมของคู่ตัวแปร เช่น "ICD10 ตั้งแต่" + "ICD10 ถึง" → "ICD10" */
function rangeTitle(a: string, b: string) {
  const strip = (s: string) => s.replace(/\s*(ตั้งแต่|เริ่ม|จาก|ถึง|สิ้นสุด|from|to)\s*$/i, "").trim();
  const x = strip(a), y = strip(b);
  return x && x === y ? x : "ICD10";
}

/** ICD10 สองตัวติดกัน (ตั้งแต่/ถึง) → กล่องช่วงรหัสเดียว */
function Icd10Range({ from, to, values, onChange }: { from: ParamDef; to: ParamDef; values: ParamValues; onChange: (v: ParamValues) => void }) {
  const a = String(values[from.name] ?? ""), b = String(values[to.name] ?? "");
  const reversed = !!a && !!b && a > b;
  return (
    <fieldset className="rounded-lg border bg-muted/30 px-3 pb-2 pt-1">
      <legend className="px-1 text-xs text-muted-foreground">ช่วงรหัส {rangeTitle(from.label, to.label)}{(from.required || to.required) && <span className="text-destructive"> *</span>}</legend>
      <div className="flex flex-wrap items-start gap-2">
        <div className="space-y-1"><div className="text-[11px] text-muted-foreground">ตั้งแต่</div>
          <Icd10Single ariaLabel={from.label} value={a} onChange={(v) => onChange({ ...values, [from.name]: v })} />
        </div>
        <div className="flex flex-col items-center gap-1 pt-5">
          <span className="text-muted-foreground">–</span>
          {(a || b) && (
            <Button type="button" variant="ghost" size="icon" className={cn("size-7", reversed && "text-warning")} title="สลับตั้งแต่/ถึง"
              onClick={() => onChange({ ...values, [from.name]: b, [to.name]: a })} aria-label="สลับรหัสตั้งแต่และถึง"><ArrowLeftRight className="size-3.5" /></Button>
          )}
        </div>
        <div className="space-y-1"><div className="text-[11px] text-muted-foreground">ถึง</div>
          <Icd10Single ariaLabel={to.label} value={b} onChange={(v) => onChange({ ...values, [to.name]: v })} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 text-xs">
        {reversed && <span className="text-warning">รหัสเริ่มต้นมากกว่ารหัสสิ้นสุด — จะไม่พบข้อมูล กด ⇄ เพื่อสลับ</span>}
        {a && !b && <button type="button" className="text-primary hover:underline" onClick={() => onChange({ ...values, [to.name]: a })}>ใช้ {fmtIcd(a)} รหัสเดียว</button>}
        {!a && !b && !from.required && <span className="text-muted-foreground">เว้นว่าง = ทุกรหัส</span>}
      </div>
    </fieldset>
  );
}

export function ParamForm({ reportId, defs, values, onChange, latest = false }: { reportId: number; defs: ParamDef[]; values: ParamValues; onChange: (v: ParamValues) => void; latest?: boolean }) {
  if (!defs.length) return <p className="text-sm text-muted-foreground">รายงานนี้ไม่มีเงื่อนไขให้เลือก</p>;
  const out: React.ReactNode[] = [];
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i], n = defs[i + 1];
    if (d.type === "icd10" && !d.multiple && n?.type === "icd10" && !n.multiple) {
      out.push(<Icd10Range key={`${d.name}-${n.name}`} from={d} to={n} values={values} onChange={onChange} />);
      i++;
      continue;
    }
    out.push(<Field key={d.name} reportId={reportId} def={d} latest={latest} value={values[d.name] ?? null} onChange={(v) => onChange({ ...values, [d.name]: v })} />);
  }
  return <div className="flex flex-wrap items-end gap-x-5 gap-y-3">{out}</div>;
}
