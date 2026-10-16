"use client";

import { BarChart3, ChevronDown, Copy, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DisplayDef, ParamDef } from "@/lib/report-types";

export type ChartExample = { title: string; hint: string; sql: string; params: ParamDef[]; chart: NonNullable<DisplayDef["chart"]> };

const FY: ParamDef[] = [{ name: "fy", type: "fiscal_year", label: "ปีงบประมาณ", required: true }];

/** ตัวอย่าง SQL สำหรับกราฟ (อ้างอิงคลินิกกายภาพบำบัด e0100 — เปลี่ยนรหัสคลินิกได้) */
const EXAMPLES: ChartExample[] = [
  {
    title: "แนวโน้มรายปีงบ (5 ปีย้อนหลัง)",
    hint: "แกน X = ปีงบประมาณ · ค่า = Visit",
    params: FY,
    chart: { type: "bar", x: "ปีงบประมาณ", y: ["Visit"], labels: true },
    sql: `SELECT
    CAST(YEAR(ovst.vstdttm + INTERVAL 3 MONTH) + 543 AS CHAR) AS \`ปีงบประมาณ\`,
    COUNT(*)                AS \`Visit\`,
    COUNT(DISTINCT ovst.hn) AS \`จำนวนคน\`
FROM ovst
WHERE ovst.cln = 'e0100'   -- รหัสคลินิก
  AND ovst.vstdttm >= DATE_SUB({fy.start}, INTERVAL 4 YEAR)
  AND ovst.vstdttm <  {fy.end_next}
GROUP BY YEAR(ovst.vstdttm + INTERVAL 3 MONTH)
ORDER BY YEAR(ovst.vstdttm + INTERVAL 3 MONTH)`,
  },
  {
    title: "แยกตามหมวด + ยอดเงินแกนขวา",
    hint: "แกน X = กลุ่มสิทธิ์ · ค่า = Visit · แกนขวา = Total (บาท)",
    params: FY,
    chart: { type: "bar", x: "กลุ่มสิทธิ์", y: ["Visit"], y2: "Total", labels: true },
    sql: `SELECT
    IFNULL(NULLIF(TRIM(pttype.inscl), ''), 'ไม่ระบุ') AS \`กลุ่มสิทธิ์\`,
    COUNT(*) AS \`Visit\`,
    IFNULL(SUM((SELECT SUM(i.rcptamt) FROM incoth i WHERE i.vn = ovst.vn AND i.an = 0)), 0) AS \`Total\`
FROM ovst
LEFT JOIN pttype ON pttype.pttype = ovst.pttype
WHERE ovst.cln = 'e0100'
  AND ovst.vstdttm >= {fy.start}
  AND ovst.vstdttm <  {fy.end_next}
GROUP BY IFNULL(NULLIF(TRIM(pttype.inscl), ''), 'ไม่ระบุ')
ORDER BY \`กลุ่มสิทธิ์\``,
  },
  {
    title: "รายเดือนในปีงบ (ต.ค. → ก.ย.)",
    hint: "แกน X = เดือน · ค่า = Visit · ลำดับเดือนมาจาก ORDER BY",
    params: FY,
    chart: { type: "bar", x: "เดือน", y: ["Visit"], labels: true },
    sql: `SELECT
    CONCAT(ELT(MONTH(ovst.vstdttm), 'ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'),
           ' ', RIGHT(YEAR(ovst.vstdttm) + 543, 2)) AS \`เดือน\`,
    COUNT(*) AS \`Visit\`
FROM ovst
WHERE ovst.cln = 'e0100'
  AND ovst.vstdttm >= {fy.start}
  AND ovst.vstdttm <  {fy.end_next}
GROUP BY YEAR(ovst.vstdttm), MONTH(ovst.vstdttm)
ORDER BY YEAR(ovst.vstdttm), MONTH(ovst.vstdttm)`,
  },
];

/** คู่มือสร้างกราฟ (แท็บ SQL) — พับเก็บได้, ปุ่ม "ใช้ตัวอย่างนี้" ใส่ SQL + ตัวแปร + ตั้งค่ากราฟให้ */
export function ChartGuide({ onUse, onGoDisplay }: { onUse: (ex: ChartExample) => void; onGoDisplay: () => void }) {
  async function copy(sql: string) {
    try { await navigator.clipboard.writeText(sql); toast.success("คัดลอก SQL แล้ว"); } catch { toast.error("คัดลอกไม่สำเร็จ"); }
  }

  return (
    <Card>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-6 [&::-webkit-details-marker]:hidden">
          <BarChart3 className="size-4 text-primary" />
          <span className="font-semibold">คู่มือ: เขียน SQL ให้แสดงเป็นกราฟ</span>
          <span className="text-sm text-muted-foreground">— ขั้นตอน + ตัวอย่างพร้อมใช้</span>
          <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>

        <CardHeader className="pt-4">
          <CardTitle className="text-base">หลักการ: 1 แถว = 1 แท่ง</CardTitle>
          <CardDescription className="leading-relaxed">
            กราฟใช้ผลที่ <b>สรุปมาแล้วด้วย GROUP BY</b> — คอลัมน์ข้อความ 1 คอลัมน์เป็นแกน X (ปี, เดือน, สิทธิ์, หัตถการ) และคอลัมน์ตัวเลขเป็นค่า (COUNT, SUM)
            · ถ้าผลเป็นรายชื่อรายคน ระบบจะนับแยกตามคอลัมน์ให้เอง แต่ควบคุมได้น้อยกว่า
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            <li><b>เขียน SQL</b> ให้มีคอลัมน์หมวด + คอลัมน์ตัวเลข แล้ว <code>GROUP BY</code> คอลัมน์หมวด · <b>ลำดับแท่งตาม <code>ORDER BY</code></b> (กราฟไม่เรียงใหม่)</li>
            <li><b>ตั้งชื่อคอลัมน์</b> ด้วย <code>AS `ชื่อไทย`</code> — ชื่อนี้คือป้ายแกน/คำอธิบายสี · ปี พ.ศ. ให้ <code>CAST(... AS CHAR)</code> ไม่งั้นจะแสดงเป็น 2,569</li>
            <li>
              <b>ไปที่แท็บ <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={onGoDisplay}>5. การแสดงผล</button></b> → ติ๊ก “กราฟ” ·
              เลือก <b>แกนหมวด (X)</b> · ติ๊ก <b>ค่า (Y)</b> · ถ้ามีค่าหน่วยต่างกัน (เช่น บาท กับ ครั้ง) เลือกคอลัมน์นั้นใน <b>แกนขวา</b> ·
              <b>ตัวเลขบนแท่ง/จุด</b> เลือกแสดงเสมอได้ · กด “ทดสอบ” ก่อน รายชื่อคอลัมน์จึงขึ้นให้เลือก
            </li>
          </ol>

          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            เคล็ดลับ: ปีงบ พ.ศ. = <code>YEAR(วันที่ + INTERVAL 3 MONTH) + 543</code> ·
            ชื่อเดือนไทย = <code>ELT(MONTH(วันที่), &apos;ม.ค.&apos;, …)</code> (ฐาน HIS เป็น TIS-620 — ใช้อักษรไทย/อังกฤษปกติ ห้ามสัญลักษณ์อย่าง ×) ·
            ใช้ตัวแปร <code>{"{fy.start}"}</code> / <code>{"{fy.end_next}"}</code> ไม่ใช่วันที่ตายตัว · ไม่ใส่ <code>DATE()</code> ครอบคอลัมน์วันที่ (ใช้ index ไม่ได้)
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {EXAMPLES.map((ex) => (
              <div key={ex.title} className="flex min-w-0 flex-col rounded-md border">
                <div className="border-b px-3 py-2">
                  <div className="text-sm font-medium">{ex.title}</div>
                  <div className="text-xs text-muted-foreground">{ex.hint}</div>
                </div>
                <pre className="max-h-56 flex-1 overflow-auto bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-100">{ex.sql}</pre>
                <div className="flex gap-2 border-t p-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => copy(ex.sql)}><Copy /> คัดลอก</Button>
                  <Button type="button" size="sm" className="ml-auto" onClick={() => onUse(ex)}><Wand2 /> ใช้ตัวอย่างนี้</Button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">“ใช้ตัวอย่างนี้” จะแทนที่ SQL + ตัวแปร และตั้งค่ากราฟให้ (ยังไม่บันทึกจนกว่าจะกดบันทึก) · ตัวอย่างอ้างอิงคลินิกกายภาพบำบัด <code>e0100</code> — เปลี่ยนรหัสคลินิกตามต้องการ</p>
        </CardContent>
      </details>
    </Card>
  );
}
