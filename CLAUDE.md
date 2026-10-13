# hisreport-app — ระบบรายงาน HIS (Next.js)

ระบบรายงานที่ผู้ดูแลสร้างรายงานจาก SQL เองได้ กำหนดสิทธิ์ตาม Role × หัวข้อรายงาน มี Dashboard และ Export Excel
ออกแบบตาม mockup `C:\AppServ\www\hisreport\design\mockup.html` (v2)

## กฎสำคัญ
- **ฐาน HIS (10.0.0.8, MariaDB 10.3, schema `hi`) อ่านอย่างเดียว** — ทุก connection ตั้ง `SET SESSION TRANSACTION READ ONLY` (`src/lib/db.ts` → `hisDb()`), SQL ของรายงานผ่าน `assertSelectOnly()` และแทนค่าแบบ `?` เสมอ ห้ามต่อ string
- ฐานของระบบเอง: MySQL 8.0 บนเครื่องนี้ `127.0.0.1:3306/hisreport_app` (ผู้ใช้ `hisreport`) — เขียนได้
- โปรเจกต์อยู่นอก `C:\AppServ\www` โดยตั้งใจ (Apache เสิร์ฟทุกไฟล์ใน www รวม `.env.local`)
- ความลับอยู่ใน `.env.local` เท่านั้น (ดู `.env.example`)

## Stack
Next.js 15 (App Router, `basePath: /hisreport-app`) + TypeScript, Tailwind v4 + shadcn/ui (style new-york), next-themes, mysql2, jose (JWT cookie), zod, recharts, exceljs
- fetch ฝั่ง client ต้องใช้ `api("/path")` จาก `src/lib/config.ts` (fetch ไม่เติม basePath ให้)
- Next 15: `params` / `searchParams` / `cookies()` เป็น Promise ต้อง await

## คำสั่ง
- `npm run db:migrate` — สร้างตาราง (`db/01_schema.sql`) + Role เริ่มต้น + ผู้ดูแล local (`ADMIN_USERNAME`/`ADMIN_PASSWORD`)
- `npm run dev` / `npm run build` / `npm start` (port 3000) → http://localhost:3000/hisreport-app
- `npx tsc --noEmit`, `npx eslint src`
- ทดสอบ engine: `npx tsx --conditions=react-server <test.ts>` (ต้องมี condition เพราะ `server-only`)

## โครงสร้าง
- `src/lib/report-engine.ts` — ตัวรันรายงาน: `{name}`, `{name.start|end|end_next}`, `[[ ... ]]` เงื่อนไขเสริม (ตัดทิ้งถ้าตัวแปรว่าง), หลายค่า → `IN (?,?)`, cache (`report_cache`), ปิดบังคอลัมน์ข้อมูลบุคคล, `SET STATEMENT max_statement_time` (MariaDB)
- คิวคิวรี่ HIS: `runOnHis()` ผ่าน `withHisSlot()` — รันพร้อมกันได้ไม่เกิน `HIS_MAX_CONCURRENT` (ค่าเริ่มต้น 2, รวมทุกผู้ใช้) รอคิวสูงสุด 2 นาที
- หน้ารายงานและ Dashboard ไม่ประมวลผลเองตอนเปิด (ผู้ใช้สั่ง) — Dashboard รันทีละ widget ตามลำดับ ไม่ยิงพร้อมกัน
- `src/lib/legacy-import.ts` — นำเข้า `reportdb.rep_query_item`: `?` ตามลำดับ query_params (`datestart`→`{date.start}`, `dateend`→`{date.end}` แบบรวมวันสุดท้าย ตรงกับ BETWEEN เดิม), วนซ้ำถ้า ? มากกว่าตัวแปร (UNION), level 4 → disabled, จำนวน ? ไม่ลงตัว → draft
- `src/lib/reports.ts` — รายงาน/เวอร์ชัน: บันทึกทับร่างถ้ายังไม่เผยแพร่, สร้างเวอร์ชันใหม่ถ้าเวอร์ชันล่าสุดเผยแพร่แล้ว
- `src/lib/saved.ts` — แฟ้มผลรายงาน (`saved_result` + `saved_result_data` gzip ของ `{columns:[{name,type}], rows:[[...]]}`): เห็นเฉพาะเจ้าของ, เก็บสำเนา SQL/ตัวแปร/ค่าเงื่อนไข/คอลัมน์ ณ ตอนบันทึก, บันทึกจาก `report_cache` ผ่าน `pendingResult()` (ไม่รับแถวจากเบราว์เซอร์ ไม่คิวรี่ HIS ซ้ำ — รายงาน ttl=0 ก็เก็บ cache 15 นาทีไว้รอบันทึก), ตอนเปิดตรวจสิทธิ์หัวข้อรายงานและปิดบังข้อมูลบุคคลใหม่, โควตา `SAVED_MAX_FILES`/`SAVED_MAX_MB`
- `src/lib/excel.ts` — `buildWorkbook()` ใช้ร่วมระหว่าง export รายงานและแฟ้มที่บันทึกไว้ (ใช้ `columnTypes` จาก HIS ถ้ามี)
- `src/lib/chart-analysis.ts` — ก่อนทำกราฟแยกชนิดคอลัมน์ (id/date/category/measure); ผลสรุปแล้ว → กราฟตรง, รายการรายบุคคล → นับ/รวมแยกตามคอลัมน์ที่ผู้ใช้เลือก, จัดกลุ่มไม่ได้ → บอกเหตุผล (ค่าที่ผู้ดูแลตั้งใน display.chart.y มาก่อนเสมอ)
- `src/lib/auth.ts` — `getCurrentUser()` (สิทธิ์รวมจากทุก Role), `authenticate()`
- `src/components/theme/color-provider.tsx` — ธีม: localStorage (`hr-theme`, `hr-color`) + `user_setting` ในฐาน (ค่าในฐานเป็นหลักหลัง login)
- ชุดสี: `<html data-color>` + ตัวแปร `--brand` ใน `globals.css` → primary/ring/sidebar/chart-1
- โทนสีพื้นฐานตาม mockup (พื้น `#f3f6fa`, เมนูข้างกรมท่า `--sidebar`, โลโก้ `--logo`, หัวตาราง `--table-head`, พื้นหน้า login `--login-bg`) — มีชุด `.dark` คู่กัน
- ชื่อระบบ `APP_NAME` ใน `src/lib/config.ts` (ตอนนี้ "HIS Report2570")

## นิยามตัวแปรช่วงวันที่
- `{date.end}` = วันสุดท้ายที่เลือก (รวมวันนั้น) → ใช้กับ `BETWEEN`
- `{date.end_next}` = วันถัดไป → ใช้กับ `col < {date.end_next}` (ใช้ index ได้ แนะนำ)
- ปีงบ (`fiscal_year`): `{fy}` = ปี พ.ศ., `.start` = 1 ต.ค. ปีก่อน, `.end` = 30 ก.ย.

## Login ด้วยบัญชี HIS (ตาม CRC.md)
- `src/lib/his-auth.ts`: `hi.dct` — `dct` = ชื่อผู้ใช้ (เทียบตรงตัวพิมพ์), `statusdct='1'` = ระงับ, รหัสผ่าน → CRC-16/CCITT-FALSE ฐานสิบ เทียบ `TRIM(psswrd)` (ลอง UTF-8 และ TIS-620 ถ้ามีอักขระไทย)
- ห้ามส่ง/แสดง/log ค่า `psswrd` เด็ดขาด — `searchHisUsers()` ไม่ดึงคอลัมน์นี้
- `authenticate()`: บัญชี local ใช้ bcrypt, นอกนั้นตรวจกับ HIS; login HIS ครั้งแรกสร้าง `app_user` (ไม่มี Role) อัตโนมัติ
- จำกัด login ผิด: 5 ครั้ง/ชื่อผู้ใช้ หรือ 20 ครั้ง/IP ใน 15 นาที (นับจาก `audit_log` action `login_fail`)
- `hi.dct.dct` เป็น `tis620_bin` (แยกตัวพิมพ์: มีทั้ง `G7` และ `g7`) → `app_user.username` ต้องเป็น `utf8mb4_bin`
- ทดสอบกับ HIS จริงแล้ว (2026-10-12): ไม่พบผู้ใช้ / รหัสผิด / ถูกระงับ ทำงานถูก — ยังไม่ได้ลอง login สำเร็จด้วยบัญชีจริง (ต้องให้ผู้ใช้ลองเอง)

## ข้อสังเกตฐาน HIS
- `hiuser` มีสิทธิ์ `ALL PRIVILEGES ... WITH GRANT OPTION` (ไม่ใช่ SELECT อย่างเดียว) — ระบบป้องกันด้วย READ ONLY session (ทดสอบแล้ว เขียนไม่ได้แม้ temp table) แต่ควรมีผู้ใช้ SELECT-only แยก
- คิวรี่เดิมบางตัวขึ้นต้นด้วย `SET SESSION group_concat_max_len = N;` → `splitSessionVars()` แปลงเป็น `SET STATEMENT` (อนุญาตเฉพาะตัวแปรใน `ALLOWED_SET_VARS`)
- คิวรี่เดิมที่เสียจากต้นทาง (#221 syntax, #236 ว่าง, #237 ไม่ใช่ SQL, #252/#253 ไม่มีตาราง l_pcu_area, #408 ใช้ iptdx ในคิวรี่ OPD) และ #220 (? ไม่ครบ) → ตอนนำเข้าตรวจด้วย EXPLAIN แล้วตั้งเป็นร่าง
- กลุ่มรายงานเดิมมีชื่อใน `reportdb.rep_menu_item.item_name` (importer ใช้อัตโนมัติ)
- **ห้ามแตะ Apache / port 88** (ผู้ใช้สั่ง) — ระบบรันตรงที่ port 3000: http://<เครื่อง>:3000/hisreport-app
- การรันเป็น service ยังไม่ได้ตั้ง (ดู SETUP.md) — หรือใช้ Docker (DOCKER.md): `Dockerfile` (standalone เมื่อ `NEXT_OUTPUT=standalone`, node_modules ใน image มาจาก `npm ci --omit=dev` เพราะ standalone trace ตกไฟล์ของ exceljs) + `docker-compose.yml` (app + mysql:8.0, migrate อัตโนมัติตอนเริ่ม, ค่าใน `.env.docker`)
- เครื่องนี้ยังไม่ได้ติดตั้ง Docker — ทดสอบได้แค่ standalone build ด้วย node (ผ่าน) ยังไม่เคย `docker build` จริง
