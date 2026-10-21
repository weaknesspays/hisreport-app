import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { SESSION_COOKIE, isThemeColor, isThemeMode, type ThemeColor, type ThemeMode } from "./config";
import { verifySession } from "./session";
import { exec, one, rows } from "./db";
import { hisAuthenticate } from "./his-auth";
import { getFlag } from "./settings";

export type CurrentUser = {
  id: number;
  username: string;
  displayName: string;
  department: string | null;
  roles: { id: number; name: string }[];
  groupIds: number[];
  canExport: boolean;
  canViewPerson: boolean;
  canAuthor: boolean;
  isAdmin: boolean;
  authSource: "his" | "local";
  /** บัญชี local ที่ผู้ดูแลตั้ง/รีเซ็ตรหัสให้ — ต้องเปลี่ยนรหัสก่อนใช้งาน */
  mustChangePassword: boolean;
  theme: ThemeMode;
  color: ThemeColor;
};

/** ผู้ใช้ที่ login อยู่ (โหลดครั้งเดียวต่อ request) */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const s = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!s) return null;

  const u = await one<{ id: number; username: string; display_name: string; department: string | null; auth_source: "his" | "local"; must_change_pw: number; pw_changed: number | null; theme: string | null; color: string | null }>(
    `SELECT u.id, u.username, u.display_name, u.department, u.auth_source, u.must_change_pw,
            UNIX_TIMESTAMP(u.password_changed_at) AS pw_changed, st.theme, st.color
     FROM app_user u LEFT JOIN user_setting st ON st.user_id = u.id
     WHERE u.id = ? AND u.is_active = 1`, [s.uid]);
  if (!u) return null;
  // เปลี่ยน/รีเซ็ตรหัสแล้ว → session ที่ออกก่อนหน้านั้นใช้ไม่ได้ (เช่น เครื่องอื่นที่ยัง login ค้าง)
  if (u.pw_changed && s.iat < Math.floor(Number(u.pw_changed))) return null;

  const roles = await rows<{ id: number; name: string; can_export: number; can_view_person: number; can_author: number; is_admin: number }>(
    `SELECT r.id, r.name, r.can_export, r.can_view_person, r.can_author, r.is_admin
     FROM user_role ur JOIN role r ON r.id = ur.role_id WHERE ur.user_id = ?`, [u.id]);
  const isAdmin = roles.some((r) => r.is_admin);

  // ผู้ดูแลระบบเห็นทุกหัวข้อ, คนอื่นเห็นตาม role_group
  const groups = isAdmin
    ? await rows<{ id: number }>("SELECT id FROM report_group")
    : roles.length
      ? await rows<{ id: number }>(
          `SELECT DISTINCT group_id AS id FROM role_group WHERE role_id IN (${roles.map(() => "?").join(",")})`,
          roles.map((r) => r.id))
      : [];

  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    department: u.department,
    roles: roles.map((r) => ({ id: r.id, name: r.name })),
    groupIds: groups.map((g) => g.id),
    canExport: isAdmin || roles.some((r) => r.can_export),
    canViewPerson: isAdmin || roles.some((r) => r.can_view_person),
    canAuthor: isAdmin || roles.some((r) => r.can_author),
    isAdmin,
    authSource: u.auth_source,
    mustChangePassword: u.auth_source === "local" && !!u.must_change_pw,
    theme: isThemeMode(u.theme) ? u.theme : "system",
    color: isThemeColor(u.color) ? u.color : "blue",
  };
});

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (u.mustChangePassword) redirect("/change-password");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (!u.isAdmin) redirect("/");
  return u;
}

/** สำหรับ API route: คืน null แทนการ redirect */
export async function apiUser(opts: { admin?: boolean; author?: boolean } = {}) {
  const u = await getCurrentUser();
  if (!u || u.mustChangePassword) return null; // ต้องเปลี่ยนรหัสก่อน — ใช้ได้แค่ /api/me/password
  if (opts.admin && !u.isAdmin) return null;
  if (opts.author && !u.canAuthor) return null;
  return u;
}

const WRONG = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
const LOCK_MINUTES = 15;
const MAX_FAIL_USER = 5;
const MAX_FAIL_IP = 20;

/** จำกัดจำนวนครั้ง login ผิด (CRC-16 ของ HIS สุ่มรหัสได้ง่าย — CRC.md ข้อ 8) นับจาก audit_log
 *  ผู้ดูแลปิดได้ที่หน้าผู้ใช้และสิทธิ์ (app_setting.login_lockout) — ยังบันทึก login_fail ตามปกติ */
async function isLocked(username: string, ip: string | null) {
  if (!(await getFlag("login_lockout"))) return false;
  const r = await one<{ by_user: number; by_ip: number }>(
    `SELECT
       SUM(BINARY detail = ?) AS by_user,
       SUM(? IS NOT NULL AND ip = ?) AS by_ip
     FROM audit_log
     WHERE action = 'login_fail' AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [username, ip, ip, LOCK_MINUTES]);
  return Number(r?.by_user ?? 0) >= MAX_FAIL_USER || Number(r?.by_ip ?? 0) >= MAX_FAIL_IP;
}

/** Role ที่ให้ผู้ใช้ HIS อัตโนมัติตอน login ครั้งแรก (ไม่มี Role ชื่อนี้ → ข้าม) */
const DEFAULT_HIS_ROLE = "เจ้าหน้าที่";

/**
 * ตรวจชื่อผู้ใช้/รหัสผ่าน
 * - บัญชี local : ตรวจกับ password_hash (bcrypt) ในฐานของระบบ
 * - บัญชี HIS   : ตรวจกับ hi.dct ด้วย CRC-16/CCITT-FALSE (ดู CRC.md) — login ครั้งแรกสร้างผู้ใช้ให้อัตโนมัติ
 *                 พร้อม Role เริ่มต้น DEFAULT_HIS_ROLE (ผู้ดูแลเปลี่ยน/ถอดออกได้ภายหลัง)
 */

export async function authenticate(username: string, password: string, ip: string | null = null): Promise<{ ok: true; id: number } | { ok: false; error: string; unavailable?: boolean }> {
  if (await isLocked(username, ip)) {
    return { ok: false, error: `ใส่รหัสผ่านผิดหลายครั้ง กรุณารอ ${LOCK_MINUTES} นาทีแล้วลองใหม่` };
  }

  const found = await one<{ id: number; username: string; auth_source: string; password_hash: string | null; is_active: number }>(
    "SELECT id, username, auth_source, password_hash, is_active FROM app_user WHERE username = ?", [username]);
  // collation ไม่สนตัวพิมพ์ → เทียบตรงตัวอีกชั้น
  const u = found && found.username === username ? found : null;

  if (u && !u.is_active) return { ok: false, error: WRONG };
  if (u?.auth_source === "local") {
    if (u.password_hash && (await bcrypt.compare(password, u.password_hash))) return { ok: true, id: u.id };
    return { ok: false, error: WRONG };
  }

  let his;
  try {
    his = await hisAuthenticate(username, password);
  } catch (e) {
    console.error("HIS auth failed", (e as Error).message);
    return { ok: false, unavailable: true, error: "เชื่อมต่อฐานข้อมูล HIS ไม่ได้ในขณะนี้ กรุณาลองใหม่ภายหลัง" };
  }
  if (!his.ok) {
    return { ok: false, error: his.reason === "suspended" ? "บัญชีผู้ใช้ถูกระงับการใช้งานในโปรแกรม HIS" : WRONG };
  }

  if (u) {
    await exec("UPDATE app_user SET display_name = ? WHERE id = ?", [his.displayName, u.id]);
    return { ok: true, id: u.id };
  }
  const created = await exec(
    "INSERT INTO app_user (username, display_name, auth_source, is_active) VALUES (?,?,'his',1)", [his.username, his.displayName]);
  await exec("INSERT IGNORE INTO user_setting (user_id) VALUES (?)", [created.insertId]);
  await exec("INSERT IGNORE INTO user_role (user_id, role_id) SELECT ?, id FROM role WHERE name = ?",
    [created.insertId, DEFAULT_HIS_ROLE]);
  return { ok: true, id: created.insertId };
}
