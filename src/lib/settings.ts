import "server-only";
import { exec, one } from "./db";

/** ค่าตั้งระบบ (ตาราง app_setting) — ไม่มีแถว = ใช้ค่าเริ่มต้น */
const DEFAULTS = {
  login_lockout: "1", // จำกัดการ login ผิด (ผู้ใช้ 5 ครั้ง / IP 20 ครั้ง ใน 15 นาที)
} as const;

export type SettingName = keyof typeof DEFAULTS;

export async function getSetting(name: SettingName): Promise<string> {
  const r = await one<{ value: string }>("SELECT value FROM app_setting WHERE name = ?", [name]);
  return r?.value ?? DEFAULTS[name];
}

export async function getFlag(name: SettingName) {
  return (await getSetting(name)) === "1";
}

export async function setSetting(name: SettingName, value: string, userId: number | null) {
  await exec(
    "INSERT INTO app_setting (name, value, updated_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)",
    [name, value, userId]);
}
