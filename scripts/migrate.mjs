// สร้างตารางและข้อมูลเริ่มต้นของระบบรายงาน
// รัน: npm run db:migrate   (อ่านค่าจาก .env.local)
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const root = path.resolve(import.meta.dirname, "..");
const env = process.env;

const conn = await mysql.createConnection({
  host: env.APP_DB_HOST, port: Number(env.APP_DB_PORT || 3306),
  user: env.APP_DB_USER, password: env.APP_DB_PASSWORD, database: env.APP_DB_NAME,
  charset: "utf8mb4", multipleStatements: true,
});

const schema = fs.readFileSync(path.join(root, "db", "01_schema.sql"), "utf8");
await conn.query(schema);
console.log("✓ สร้าง/ตรวจตารางแล้ว");

// Role เริ่มต้น
const roles = [
  ["ผู้ดูแลระบบ", 1, 1, 1, 1],
  ["ผู้บริหาร", 1, 0, 0, 0],
  ["เจ้าหน้าที่", 0, 0, 0, 0],
];
for (const r of roles) {
  await conn.query("INSERT IGNORE INTO role (name, can_export, can_view_person, can_author, is_admin) VALUES (?,?,?,?,?)", r);
}

// หมวดเริ่มต้น
const [[cat]] = await conn.query("SELECT COUNT(*) AS n FROM report_category");
if (!cat.n) {
  await conn.query("INSERT INTO report_category (name, sort) VALUES ('ผู้บริหาร / คุณภาพ', 1), ('บริการ', 2), ('คลินิกพิเศษ', 3)");
}

// ผู้ดูแลระบบ (บัญชี local)
const username = env.ADMIN_USERNAME || "admin";
const [[exists]] = await conn.query("SELECT id FROM app_user WHERE username = ?", [username]);
if (!exists) {
  if (!env.ADMIN_PASSWORD) throw new Error("ตั้ง ADMIN_PASSWORD ใน .env.local ก่อน");
  const hash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
  const [res] = await conn.query(
    "INSERT INTO app_user (username, display_name, department, auth_source, password_hash) VALUES (?,?,?,?,?)",
    [username, "ผู้ดูแลระบบ", "IT", "local", hash]);
  const [[admin]] = await conn.query("SELECT id FROM role WHERE name = 'ผู้ดูแลระบบ'");
  await conn.query("INSERT INTO user_role (user_id, role_id) VALUES (?,?)", [res.insertId, admin.id]);
  await conn.query("INSERT INTO user_setting (user_id) VALUES (?)", [res.insertId]);
  console.log(`✓ สร้างผู้ดูแลระบบ "${username}" แล้ว (รหัสผ่านใน .env.local → ADMIN_PASSWORD)`);
} else {
  console.log(`• ผู้ดูแลระบบ "${username}" มีอยู่แล้ว`);
}

await conn.end();
console.log("เสร็จ");
