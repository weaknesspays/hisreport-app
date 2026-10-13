"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { api, isThemeColor, isThemeMode, type ThemeColor, type ThemeMode } from "@/lib/config";

/**
 * ธีมของผู้ใช้เก็บ 2 ที่:
 * - localStorage (hr-theme, hr-color) → เปิดเบราว์เซอร์เดิมแล้วได้ธีมเดิมทันที
 * - ฐานข้อมูล (user_setting) → login เครื่องอื่นแล้วยังได้ธีมเดิม (ค่าในฐานเป็นหลัก)
 */

type Ctx = { color: ThemeColor; setColor: (c: ThemeColor) => void };
const ColorCtx = createContext<Ctx>({ color: "blue", setColor: () => {} });
export const useColor = () => useContext(ColorCtx);

function saveToServer(body: { theme?: ThemeMode; color?: ThemeColor }) {
  fetch(api("/settings/theme"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function ColorProvider({ children, serverColor, loggedIn }: { children: React.ReactNode; serverColor: ThemeColor | null; loggedIn: boolean }) {
  const [color, setColorState] = useState<ThemeColor>(serverColor ?? "blue");

  useEffect(() => {
    if (serverColor) {
      try { localStorage.setItem("hr-color", serverColor); } catch {}
      return;
    }
    try {
      const c = localStorage.getItem("hr-color");
      if (isThemeColor(c)) setColorState(c);
    } catch {}
  }, [serverColor]);

  useEffect(() => {
    document.documentElement.dataset.color = color;
  }, [color]);

  const setColor = useCallback((c: ThemeColor) => {
    setColorState(c);
    try { localStorage.setItem("hr-color", c); } catch {}
    if (loggedIn) saveToServer({ color: c });
  }, [loggedIn]);

  return <ColorCtx.Provider value={{ color, setColor }}>{children}</ColorCtx.Provider>;
}

/** ใช้ค่าธีมจากฐานข้อมูลหลัง login และบันทึกกลับเมื่อผู้ใช้เปลี่ยน */
export function ThemeSync({ serverTheme, loggedIn }: { serverTheme: ThemeMode | null; loggedIn: boolean }) {
  const { theme, setTheme } = useTheme();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || !theme) return;
    applied.current = true;
    if (loggedIn && serverTheme && theme !== serverTheme) setTheme(serverTheme);
  }, [theme, serverTheme, loggedIn, setTheme]);

  const last = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!applied.current || !loggedIn || !isThemeMode(theme)) return;
    if (last.current === undefined) { last.current = theme; return; }
    if (last.current !== theme) {
      last.current = theme;
      saveToServer({ theme });
    }
  }, [theme, loggedIn]);

  return null;
}
