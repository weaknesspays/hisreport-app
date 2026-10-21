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
  { id: "green", label: "เขียว", swatch: "#00a63e" },
  { id: "violet", label: "ม่วง", swatch: "#7f22fe" },
  { id: "orange", label: "ส้ม", swatch: "#f54900" },
  { id: "rose", label: "ชมพูแดง", swatch: "#ec003f" },
] as const;

export type ThemeColor = (typeof THEME_COLORS)[number]["id"];
export type ThemeMode = "light" | "dark" | "system";

export function isThemeColor(v: unknown): v is ThemeColor {
  return THEME_COLORS.some((c) => c.id === v);
}
export function isThemeMode(v: unknown): v is ThemeMode {
  return v === "light" || v === "dark" || v === "system";
}

/** เครดิตผู้พัฒนา — แสดงตัวเล็กท้ายเมนูด้านข้าง */
export const DEVELOPER = { title: "ผู้พัฒนา", name: "นายเฉลิมพล ศรีคำ", position: "นักวิชาการคอมพิวเตอร์ชำนาญการ", org: "โรงพยาบาลศรีเมืองใหม่" };
