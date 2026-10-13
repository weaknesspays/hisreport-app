// ค่าที่ใช้ได้ทั้งฝั่ง server และ client
export const BASE_PATH = "/hisreport-app";
export const APP_NAME = "HIS Report2570";

/** path สำหรับ fetch ไปที่ API ของระบบ (fetch ไม่เติม basePath ให้เอง) */
export function api(path: string) {
  return `${BASE_PATH}/api${path.startsWith("/") ? path : `/${path}`}`;
}

export const SESSION_COOKIE = "hr_session";
export const SESSION_HOURS = 8;

export const THEME_COLORS = [
  { id: "blue", label: "น้ำเงิน", swatch: "#1b64b5" },
  { id: "teal", label: "เขียวน้ำทะเล", swatch: "#0f8b8d" },
  { id: "green", label: "เขียว", swatch: "oklch(0.627 0.194 149.214)" },
  { id: "violet", label: "ม่วง", swatch: "oklch(0.541 0.281 293.009)" },
  { id: "orange", label: "ส้ม", swatch: "oklch(0.646 0.222 41.116)" },
  { id: "rose", label: "ชมพูแดง", swatch: "oklch(0.586 0.253 17.585)" },
] as const;

export type ThemeColor = (typeof THEME_COLORS)[number]["id"];
export type ThemeMode = "light" | "dark" | "system";

export function isThemeColor(v: unknown): v is ThemeColor {
  return THEME_COLORS.some((c) => c.id === v);
}
export function isThemeMode(v: unknown): v is ThemeMode {
  return v === "light" || v === "dark" || v === "system";
}
