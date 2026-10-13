import { fiscalYearOf, resolveDateWord, ymd } from "./dates";
import type { ParamDef, ParamValue, ParamValues } from "./report-types";

export function isEmptyValue(v: ParamValue | undefined) {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return !v.start || !v.end;
}

/** ค่าเริ่มต้นของตัวแปร (daterange default เช่น "fy_start,today") */
export function defaultValue(def: ParamDef, today = ymd(new Date())): ParamValue {
  switch (def.type) {
    case "daterange": {
      const [a, b] = (def.default || "fy_start,today").split(",");
      const start = resolveDateWord(a, today), end = resolveDateWord(b, today);
      return start && end ? { start, end } : null;
    }
    case "date": return resolveDateWord(def.default || "today", today);
    case "fiscal_year": return String(def.default && /^\d{4}$/.test(def.default) ? def.default : fiscalYearOf(today));
    default:
      if (def.multiple) return def.default ? def.default.split(",").map((s) => s.trim()).filter(Boolean) : [];
      return def.default ?? "";
  }
}

export function defaultValues(defs: ParamDef[], saved?: ParamValues | null): ParamValues {
  const out: ParamValues = {};
  for (const d of defs) out[d.name] = saved && d.name in saved ? saved[d.name] : defaultValue(d);
  return out;
}
