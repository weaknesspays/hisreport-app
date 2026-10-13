import type { NextConfig } from "next";
import { BASE_PATH } from "./src/lib/config";

const nextConfig: NextConfig = {
  // รันแยกที่ port 3000 → http://<เครื่อง>:3000/hisreport-app (ไม่ผ่าน Apache port 88)
  basePath: BASE_PATH,
  // bcryptjs ต้องอยู่ใน node_modules ของ standalone ด้วย เพราะ scripts/migrate.mjs (รันตอนเริ่ม container) ใช้
  serverExternalPackages: ["mysql2", "exceljs", "bcryptjs"],
  // Docker ใช้ server.js แบบ standalone (ตั้งใน Dockerfile) — npm start แบบเดิมไม่กระทบ
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;
