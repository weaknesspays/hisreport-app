"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Laptop, Moon, Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { THEME_COLORS } from "@/lib/config";
import { useColor } from "./color-provider";
import { cn } from "@/lib/utils";

const MODES = [
  { id: "light", label: "สว่าง", icon: Sun },
  { id: "dark", label: "มืด", icon: Moon },
  { id: "system", label: "ตามเครื่อง", icon: Laptop },
] as const;

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const { color, setColor } = useColor();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">โหมดการแสดงผล</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          {MODES.map((m) => (
            <button key={m.id} type="button" onClick={() => setTheme(m.id)}
              className={cn("flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors hover:bg-accent",
                mounted && theme === m.id && "border-primary bg-primary/5 ring-1 ring-primary")}>
              <m.icon className="size-6" /> {m.label}
            </button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">สีหลักของระบบ</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEME_COLORS.map((c) => (
            <button key={c.id} type="button" onClick={() => setColor(c.id)}
              className={cn("flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-accent", color === c.id && "border-primary ring-1 ring-primary")}>
              <span className="grid size-8 place-items-center rounded-full" style={{ background: c.swatch }}>
                {color === c.id && <Check className="size-4 text-white" />}
              </span>
              {c.label}
            </button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">ตัวอย่าง</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button>ปุ่มหลัก</Button>
          <Button variant="outline">ปุ่มรอง</Button>
          <Button variant="secondary">ปุ่มเสริม</Button>
          <span className="flex gap-1">{[1, 2, 3, 4, 5].map((i) => <span key={i} className="h-8 w-6 rounded" style={{ background: `var(--chart-${i})` }} />)}</span>
        </CardContent>
      </Card>
    </div>
  );
}
