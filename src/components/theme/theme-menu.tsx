"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Laptop, Moon, Palette, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEME_COLORS } from "@/lib/config";
import { useColor } from "./color-provider";

const MODES = [
  { id: "light", label: "สว่าง", icon: Sun },
  { id: "dark", label: "มืด", icon: Moon },
  { id: "system", label: "ตามเครื่อง", icon: Laptop },
] as const;

export function ThemeMenu() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { color, setColor } = useColor();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="ธีมและสี">
          {mounted && resolvedTheme === "dark" ? <Moon className="size-5" /> : <Sun className="size-5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>โหมดการแสดงผล</DropdownMenuLabel>
        {MODES.map((m) => (
          <DropdownMenuItem key={m.id} onClick={() => setTheme(m.id)}>
            <m.icon className="size-4" /> {m.label}
            {mounted && theme === m.id && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2"><Palette className="size-4" /> สีหลักของระบบ</DropdownMenuLabel>
        <div className="grid grid-cols-6 gap-1.5 px-2 pb-2">
          {THEME_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              aria-label={c.label}
              onClick={() => setColor(c.id)}
              className="grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-popover transition hover:scale-110 data-[on=true]:ring-2 data-[on=true]:ring-foreground"
              data-on={color === c.id}
              style={{ background: c.swatch }}
            >
              {color === c.id && <Check className="size-3.5 text-white" />}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
