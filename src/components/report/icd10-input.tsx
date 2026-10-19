"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/config";
import { cn } from "@/lib/utils";

export type Icd = { code: string; name: string; nameTh: string; billable: boolean };

/** J440 → J44.0 (แสดงผลเท่านั้น — ค่าที่ส่งไปคิวรี่ไม่มีจุด ตรงกับ hi.icd101) */
export const fmtIcd = (c: string) => (c.length > 3 ? `${c.slice(0, 3)}.${c.slice(3)}` : c);
const norm = (s: string) => s.trim().toUpperCase().replace(/\./g, "");
const isCode = (c: string) => /^[A-Z][0-9A-Z]{1,6}$/.test(c);

/** แคชชื่อรหัสร่วมกันทั้งหน้า (ช่องตั้งแต่/ถึง/หลายค่า ไม่ต้องยิงซ้ำ) */
const nameCache = new Map<string, Icd | null>();
export function useIcdNames(codes: string[]) {
  const key = codes.filter(Boolean).join(",");
  const [, bump] = useState(0);
  useEffect(() => {
    const need = key.split(",").filter((c) => c && !nameCache.has(c));
    if (!need.length) return;
    let alive = true;
    const t = setTimeout(() => {
      fetch(api(`/icd10?codes=${encodeURIComponent(need.join(","))}`)).then((r) => r.json()).then((d: { items?: Icd[] }) => {
        for (const c of need) nameCache.set(c, d.items?.find((x) => x.code === c) ?? null);
        if (alive) bump((n) => n + 1);
      }).catch(() => {});
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [key]);
  return (c: string) => nameCache.get(c);
}

function useSearch(q: string, enabled: boolean) {
  const [items, setItems] = useState<Icd[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled || !q.trim()) { setItems([]); return; }
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(api(`/icd10?q=${encodeURIComponent(q.trim())}`)).then((r) => r.json()).then((d: { items?: Icd[] }) => {
        if (!alive) return;
        for (const x of d.items ?? []) nameCache.set(x.code, x);
        setItems(d.items ?? []); setLoading(false);
      }).catch(() => alive && setLoading(false));
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [q, enabled]);
  return { items, loading };
}

/** ช่องพิมพ์ + รายการแนะนำ (ใช้ทั้งแบบค่าเดียวและหลายค่า) */
/**
 * รับเฉพาะรหัส ICD10: A-Z 0-9 และจุด (ตัวพิมพ์ใหญ่อัตโนมัติ) ตัวแรกต้องเป็นตัวอักษร · allowComma = ช่องหลายค่า (วางหลายรหัสคั่น , ได้)
 * คืน rejected = มีอักขระที่ถูกตัดทิ้ง (เช่น พิมพ์ด้วยแป้นภาษาไทย)
 */
function sanitize(raw: string, allowComma = false) {
  const up = raw.toUpperCase();
  // รูปแบบรหัสใน hi.icd101 ทุกตัว: ตัวอักษร 1 + ตัวเลข 2 + (จุด) + ตัวเลข/อักษรไม่เกิน 4 เช่น J44, J44.0, U77X
  const one = (p: string) => {
    let out = "", body = 0;
    for (const ch of p) {
      if (!out) { if (/[A-Z]/.test(ch)) out = ch; continue; }
      if (body < 2) { if (/\d/.test(ch)) { out += ch; body++; } continue; }
      if (ch === "." && !out.includes(".")) { out += ch; continue; }
      if (/[0-9A-Z]/.test(ch) && body < 6) { out += ch; body++; }
    }
    return out;
  };
  const parts = (allowComma ? up.split(",") : [up]).map(one);
  const clean = parts.join(allowComma ? "," : "");
  return { clean, rejected: clean.replace(/,/g, "").length < up.replace(/[\s,]/g, "").length };
}

function IcdCombobox({ text, onText, onPick, onKeyEmpty, placeholder, className, invalid, ariaLabel, allowComma = false }: {
  text: string; onText: (s: string) => void; onPick: (x: Icd) => void; onKeyEmpty?: (e: React.KeyboardEvent) => void;
  placeholder?: string; className?: string; invalid?: boolean; ariaLabel: string; allowComma?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [rejected, setRejected] = useState(false);
  useEffect(() => { if (!rejected) return; const t = setTimeout(() => setRejected(false), 3000); return () => clearTimeout(t); }, [rejected]);
  const { items, loading } = useSearch(text, open);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setHi(0), [items]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function key(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && open && items[hi]) { e.preventDefault(); onPick(items[hi]); setOpen(false); }
    else if (e.key === "Escape") setOpen(false);
    else onKeyEmpty?.(e);
  }

  return (
    <div ref={box} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        role="combobox" aria-expanded={open && !!text} aria-controls={listId} aria-autocomplete="list" aria-label={ariaLabel}
        aria-activedescendant={open && items[hi] ? `${listId}-${hi}` : undefined}
        value={text} placeholder={placeholder} autoComplete="off" spellCheck={false}
        onChange={(e) => { const r = sanitize(e.target.value, allowComma); if (r.rejected) setRejected(true); onText(r.clean); setOpen(true); }}
        inputMode="text" lang="en" maxLength={allowComma ? 200 : 8}
        onFocus={() => setOpen(true)} onKeyDown={key}
        className={cn(
          "h-9 w-full rounded-md border bg-transparent pl-8 pr-7 font-mono text-sm uppercase shadow-xs outline-none transition-[color,box-shadow] placeholder:font-sans placeholder:normal-case placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30",
          invalid && "border-destructive/60 focus-visible:ring-destructive/30",
        )}
      />
      {rejected && (
        <div role="status" className="absolute left-0 top-full z-50 mt-1 w-max max-w-[min(22rem,calc(100vw-2rem))] rounded-md border border-warning/50 bg-popover px-2.5 py-1.5 text-xs text-warning shadow-md">
          รับเฉพาะรหัส ICD10: ตัวอักษร 1 ตัว + ตัวเลข เช่น J44.0 — ตรวจว่าใช้แป้นภาษาอังกฤษ
        </div>
      )}
      {loading && open && text && <Loader2 className="absolute right-2 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {open && text.trim() && !loading && !rejected && (
        <ul id={listId} role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-80 w-[min(34rem,calc(100vw-2rem))] overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {items.map((x, i) => (
            <li key={x.code} id={`${listId}-${i}`} role="option" aria-selected={i === hi}
              onMouseDown={(e) => { e.preventDefault(); onPick(x); setOpen(false); }} onMouseEnter={() => setHi(i)}
              className={cn("flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm", i === hi && "bg-accent")}>
              <span className="w-14 shrink-0 font-mono font-semibold text-primary">{fmtIcd(x.code)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{x.nameTh || x.name}</span>
                {x.nameTh && x.name && <span className="block truncate text-xs text-muted-foreground">{x.name}</span>}
              </span>
              {!x.billable && <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground" title="รหัสหมวด (ใช้ลงรหัสโดยตรงไม่ได้)">หมวด</Badge>}
            </li>
          ))}
          {!items.length && <li className="px-2 py-3 text-center text-sm text-muted-foreground">ไม่พบรหัสที่ขึ้นต้นด้วย {text.toUpperCase()}</li>}
        </ul>
      )}
    </div>
  );
}

/** ชื่อโรคใต้ช่อง: ชื่อไทย (ชี้ดูชื่ออังกฤษ) / ไม่พบรหัส */
function IcdName({ code, info }: { code: string; info: Icd | null | undefined }) {
  if (!code) return <span className="text-muted-foreground">พิมพ์รหัส ICD10 เช่น J44 หรือ J44.0</span>;
  if (info === undefined) return <span className="text-muted-foreground">…</span>;
  if (info === null) return <span className="text-destructive">ไม่พบรหัส {fmtIcd(code)} ใน ICD10</span>;
  return <span title={info.name}>{info.nameTh || info.name}</span>;
}

/** ICD10 ค่าเดียว — แสดง J44.0 แต่ส่งค่า J440 */
export function Icd10Single({ value, onChange, ariaLabel, className }: { value: string; onChange: (v: string) => void; ariaLabel: string; className?: string }) {
  const code = norm(value);
  const [text, setText] = useState(fmtIcd(code));
  // ค่าที่ช่องนี้ส่งออกเอง — ถ้า value เปลี่ยนจากข้างนอก (เช่น เปิดลิงก์แชร์/สลับช่อง) ค่อยเขียนทับข้อความในช่อง
  const emitted = useRef(code);
  useEffect(() => { if (code !== emitted.current) { emitted.current = code; setText(fmtIcd(code)); } }, [code]);
  const emit = (c: string) => { emitted.current = c; onChange(c); };
  const name = useIcdNames([code]);
  const info = code ? name(code) : undefined;
  const pending = !!text.trim() && !isCode(norm(text)); // พิมพ์ชื่อโรคแต่ยังไม่ได้เลือกรหัส → ยังไม่กรอง
  return (
    <div className={cn("w-56 space-y-1", className)}>
      <div className="relative">
        <IcdCombobox ariaLabel={ariaLabel} text={text} placeholder="รหัส เช่น J44.0" invalid={info === null}
          onText={(s) => { setText(s); const c = norm(s); emit(isCode(c) ? c : ""); }}
          onPick={(x) => { setText(fmtIcd(x.code)); emit(x.code); }} />
        {text && (
          <button type="button" onClick={() => { setText(""); emit(""); }} aria-label={`ล้าง ${ariaLabel}`}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>
        )}
      </div>
      <div className="min-h-4 truncate text-xs">{pending ? <span className="text-warning">พิมพ์รหัสอย่างน้อย 2 ตัว เช่น J4 (ยังไม่ได้ใช้กรอง)</span> : <IcdName code={code} info={info} />}</div>
    </div>
  );
}

/** ICD10 หลายค่า — ป้ายรหัส + ช่องค้นหา (Enter หรือ , เพื่อเพิ่มรหัสที่พิมพ์) */
export function Icd10Multi({ value, onChange, ariaLabel }: { value: string[]; onChange: (v: string[]) => void; ariaLabel: string }) {
  const [text, setText] = useState("");
  const name = useIcdNames(value);
  const add = (c: string) => { const n = norm(c); if (n && !value.includes(n)) onChange([...value, n]); setText(""); };
  return (
    <div className="w-[26rem] max-w-full space-y-1.5">
      <IcdCombobox ariaLabel={ariaLabel} text={text} placeholder="พิมพ์รหัสแล้วกด Enter เช่น I10, E11.9" allowComma onText={setText} onPick={(x) => add(x.code)}
        onKeyEmpty={(e) => {
          if ((e.key === "Enter" || e.key === ",") && text.trim()) { e.preventDefault(); text.split(",").forEach(add); }
          else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
        }} />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((c) => {
            const info = name(c);
            return (
              <Badge key={c} variant="secondary" className={cn("h-6 gap-1 pr-0.5 font-normal", info === null && "border-destructive/50 text-destructive")} title={info ? `${info.nameTh} — ${info.name}` : info === null ? "ไม่พบรหัสนี้ใน ICD10" : ""}>
                <span className="font-mono font-semibold">{fmtIcd(c)}</span>
                {info && <span className="max-w-40 truncate text-muted-foreground">{info.nameTh || info.name}</span>}
                <button type="button" onClick={() => onChange(value.filter((x) => x !== c))} className="rounded p-0.5 hover:bg-muted" aria-label={`ลบ ${c}`}><X className="size-3" /></button>
              </Badge>
            );
          })}
          <button type="button" onClick={() => onChange([])} className="text-xs text-muted-foreground hover:text-foreground hover:underline">ล้างทั้งหมด</button>
        </div>
      )}
    </div>
  );
}
