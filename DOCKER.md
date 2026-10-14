# รันระบบรายงาน HIS ด้วย Docker

ประกอบด้วย 2 container
- **hisreport-app**: เว็บ (Next.js) ที่ port 3000 → `http://<เครื่อง>:3000/hisreport-app`
- **hisreport-db**: MySQL 8 เก็บฐานข้อมูลของระบบ (รายงาน สิทธิ์ แฟ้มที่บันทึก) ใน volume `hisreport-db` ข้อมูลไม่หายเมื่อลบหรืออัปเดต container

ฐาน HIS (10.0.0.8) อยู่นอก Docker ระบบเชื่อมออกไปผ่านเครือข่ายของเครื่อง host
**เครื่องที่รัน Docker ต้องต่อ 10.0.0.8:3306 ได้**

---

## 1. ติดตั้ง Docker (ครั้งเดียว)
- **Windows**: ติดตั้ง Docker Desktop (ใช้ WSL 2) แล้วเปิดโปรแกรมทิ้งไว้
- **Linux**: ติดตั้ง Docker Engine + compose plugin

ตรวจด้วย `docker compose version`

## 2. ตั้งค่า
```powershell
cd C:\AppServ\hisreport-app
copy .env.docker.example .env.docker
notepad .env.docker
```
แก้ทุกค่าที่เป็น `CHANGE_ME`
- `APP_DB_PASSWORD` และ `MYSQL_PASSWORD` ต้องเป็นค่าเดียวกัน
- รหัสผ่าน MySQL ใช้ตัวอักษรอังกฤษและตัวเลข (เลี่ยงอักขระพิเศษ ขั้นตอนนำเข้าและสำรองข้อมูลจะง่ายกว่า)
- `HIS_DB_PASSWORD`, `SESSION_SECRET`, `ADMIN_PASSWORD` คัดลอกจาก `.env.local` เดิมได้

## 3. ย้ายข้อมูลเดิมจาก MySQL ของ AppServ
ข้ามได้ถ้าจะเริ่มใหม่ ถ้าข้าม ระบบจะสร้างตารางและบัญชี admin ให้เองตอนเริ่ม แล้วนำเข้ารายงานจาก rep_query_item ใหม่ในหน้าเว็บ

```powershell
# 3.1 ส่งออกจาก MySQL ของ AppServ (ถามรหัส root ของ AppServ)
C:\AppServ\MySQL\bin\mysqldump.exe -u root -p --single-transaction --no-tablespaces --default-character-set=utf8mb4 --result-file=hisreport_app.sql hisreport_app

# 3.2 เปิดเฉพาะฐานข้อมูลก่อน แล้วรอ ~30 วินาทีให้พร้อม (STATUS = healthy)
docker compose up -d db
docker compose ps

# 3.3 นำเข้า
docker compose cp hisreport_app.sql db:/tmp/hisreport_app.sql
docker compose exec db sh -c 'mysql -uroot -p$MYSQL_ROOT_PASSWORD --default-character-set=utf8mb4 hisreport_app < /tmp/hisreport_app.sql'
```
ข้อสำคัญ
- **ใช้ `--result-file`** อย่าใช้ `>` ใน PowerShell 5 เพราะจะได้ไฟล์ UTF-16 และภาษาไทยเสีย
- **ไฟล์ `hisreport_app.sql` มีข้อมูลผู้ใช้และแฟ้มที่บันทึกไว้**: ลบทิ้งเมื่อนำเข้าเสร็จ

## 4. เปิดระบบ
หยุดตัวที่รันด้วย `npm start` ก่อน เพราะใช้ port 3000 เหมือนกัน แล้วรัน
```powershell
docker compose up -d --build
docker compose ps                      # app ควรเป็น healthy ภายใน ~1 นาที
docker compose logs -f app             # ดู log (Ctrl+C ออก)
```
- **build ครั้งแรก**: ใช้เวลาหลายนาที และต้องต่ออินเทอร์เน็ต (ดาวน์โหลด npm package และฟอนต์ Sarabun)
- **ทุกครั้งที่ container เริ่ม**: ระบบรัน `scripts/migrate.mjs` ให้อัตโนมัติ สร้างตารางที่ยังไม่มี โดยไม่ลบข้อมูลเดิม
- **เปิดเองหลังรีสตาร์ทเครื่อง**: ตั้ง `restart: unless-stopped` ไว้แล้ว (Docker Desktop ต้องตั้ง "Start when you sign in")

## 4.1 ถ้าฐาน hisreport_app อยู่เซิร์ฟเวอร์อื่น
ใช้ MySQL 8 ที่มีอยู่แล้วบนเซิร์ฟเวอร์อื่น แทน container `db`

**ฝั่งเซิร์ฟเวอร์ฐานข้อมูล** (ทำครั้งเดียว ด้วยผู้ใช้ root ของ MySQL นั้น) แทน `<IP เครื่อง Docker>` ด้วย IP ของเครื่องที่รัน Docker
```sql
CREATE DATABASE IF NOT EXISTS hisreport_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'hisreport'@'<IP เครื่อง Docker>' IDENTIFIED BY '<รหัสผ่าน>';
GRANT ALL PRIVILEGES ON hisreport_app.* TO 'hisreport'@'<IP เครื่อง Docker>';
FLUSH PRIVILEGES;
```
- MySQL ต้องรับการเชื่อมต่อจากเครื่องอื่น: `bind-address` ใน my.ini / my.cnf ต้องไม่ใช่ `127.0.0.1`
- เปิด firewall port 3306 ให้เฉพาะ IP เครื่อง Docker
- ตั้งเวลาเซิร์ฟเวอร์เป็นเวลาไทย (หรือ `default-time-zone='+07:00'`) เพราะระบบใช้ `NOW()` คิดเวลาหมดอายุของ cache

**ฝั่งเครื่อง Docker**: ใน `.env.docker` แก้
```
APP_DB_HOST=<IP เซิร์ฟเวอร์ฐานข้อมูล>
APP_DB_PORT=3306
APP_DB_USER=hisreport
APP_DB_PASSWORD=<รหัสผ่านข้างบน>
```
(`MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` ไม่ใช้ในกรณีนี้) แล้วเปิดระบบด้วยไฟล์ที่ไม่มี container db
```powershell
docker compose -f docker-compose.external-db.yml up -d --build
```
ตารางจะถูกสร้างให้อัตโนมัติตอน app เริ่ม คำสั่งอื่นในข้อ 5 ให้เติม `-f docker-compose.external-db.yml` ด้วย และสำรองข้อมูลทำบนเซิร์ฟเวอร์ฐานข้อมูลด้วย `mysqldump` ตามปกติ

## 5. งานประจำ
| งาน | คำสั่ง |
|---|---|
| อัปเดตหลังแก้โค้ด | `docker compose up -d --build` |
| หยุด / เปิด | `docker compose stop` / `docker compose start` |
| ดู log | `docker compose logs -f app` |
| สำรองฐานข้อมูล | ดูด้านล่าง |

```powershell
# สำรอง → ได้ไฟล์ backup.sql ในโฟลเดอร์ปัจจุบัน
docker compose exec db sh -c 'mysqldump -uroot -p$MYSQL_ROOT_PASSWORD --single-transaction --default-character-set=utf8mb4 hisreport_app > /tmp/backup.sql'
docker compose cp db:/tmp/backup.sql .\backup.sql
```

⚠️ **`docker compose down -v` ลบ volume = ลบฐานข้อมูลของระบบทั้งหมด** ถ้าจะหยุดระบบ ใช้ `docker compose down` (ไม่มี `-v`)

## 6. แก้ปัญหา
| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| "เชื่อมต่อฐานข้อมูล HIS ไม่ได้" | เครื่อง host ต่อ 10.0.0.8:3306 ไม่ได้ → ทดสอบ `Test-NetConnection 10.0.0.8 -Port 3306` บนเครื่อง host |
| app ขึ้น unhealthy / restart วน | `docker compose logs app` → ส่วนใหญ่เกิดจากรหัสผ่านใน `.env.docker` ไม่ตรงกับฐานข้อมูล |
| แก้ `MYSQL_PASSWORD` แล้วต่อไม่ได้ | MySQL ใช้รหัสจากตอนสร้าง volume ครั้งแรกเท่านั้น → เปลี่ยนรหัสใน MySQL เองด้วย `ALTER USER` หรือเปลี่ยนกลับเป็นค่าเดิม |
| port 3000 ถูกใช้ | ยังมี `npm start` รันอยู่ → ปิดก่อน หรือแก้ `"3000:3000"` เป็น `"3001:3000"` ใน docker-compose.yml |
| เข้า MySQL ด้วยโปรแกรมภายนอก | เปิดบรรทัด `ports` ของ db ใน docker-compose.yml → ต่อที่ `127.0.0.1:3307` |
