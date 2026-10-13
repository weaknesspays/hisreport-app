import "server-only";
import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";

declare global {
  var __appPool: Pool | undefined;
  var __hisPool: Pool | undefined;
}

/** ฐานข้อมูลของระบบรายงาน (อ่าน/เขียนได้) */
export function appDb(): Pool {
  if (!global.__appPool) {
    global.__appPool = mysql.createPool({
      host: process.env.APP_DB_HOST,
      port: Number(process.env.APP_DB_PORT || 3306),
      user: process.env.APP_DB_USER,
      password: process.env.APP_DB_PASSWORD,
      database: process.env.APP_DB_NAME,
      charset: "utf8mb4",
      connectionLimit: 10,
      dateStrings: true,
    });
  }
  return global.__appPool;
}

/**
 * ฐานข้อมูล HIS — อ่านอย่างเดียวเสมอ
 * ทุก connection ถูกตั้ง READ ONLY ก่อนใช้งาน (ห้ามเพิ่ม/ลบ/แก้ไขข้อมูล HIS)
 */
export function hisDb(): Pool {
  if (!global.__hisPool) {
    const pool = mysql.createPool({
      host: process.env.HIS_DB_HOST,
      port: Number(process.env.HIS_DB_PORT || 3306),
      user: process.env.HIS_DB_USER,
      password: process.env.HIS_DB_PASSWORD,
      database: process.env.HIS_DB_NAME,
      charset: "utf8",
      connectionLimit: 5,
      connectTimeout: 10000,
      dateStrings: true,
      multipleStatements: false,
    });
    pool.on("connection", (conn) => {
      conn.query("SET SESSION TRANSACTION READ ONLY");
    });
    global.__hisPool = pool;
  }
  return global.__hisPool;
}

export async function rows<T = RowDataPacket>(sql: string, args: unknown[] = []): Promise<T[]> {
  const [r] = await appDb().query<RowDataPacket[]>(sql, args);
  return r as T[];
}

export async function one<T = RowDataPacket>(sql: string, args: unknown[] = []): Promise<T | null> {
  const r = await rows<T>(sql, args);
  return r[0] ?? null;
}

export async function exec(sql: string, args: unknown[] = []): Promise<ResultSetHeader> {
  const [r] = await appDb().query<ResultSetHeader>(sql, args);
  return r;
}
