# คู่มือติดตั้งระบบรายงาน HIS (HIS Report2570)

สำหรับเจ้าหน้าที่ IT ที่นำระบบไปติดตั้งใช้งาน

ระบบเป็นเว็บแอป ผู้ใช้เปิดผ่านเบราว์เซอร์ที่ `http://<เครื่องเซิร์ฟเวอร์>:3000/hisreport-app`
ดึงข้อมูลจากฐาน HIS แบบ**อ่านอย่างเดียว** และเก็บข้อมูลของระบบเอง (รายงาน สิทธิ์ ผู้ใช้ แฟ้มที่บันทึก) ในฐาน MySQL แยกต่างหาก

```
 ผู้ใช้ (เบราว์เซอร์) ──► เซิร์ฟเวอร์รายงาน :3000 ──► ฐาน HIS (MariaDB/MySQL, อ่านอย่างเดียว)
                               │
                               └──► ฐานของระบบ hisreport_app (MySQL 8)
```

---

## 1. สิ่งที่ต้องเตรียม

### 1.1 เครื่องเซิร์ฟเวอร์
| รายการ | ขั้นต่ำ | แนะนำ |
|---|---|---|
| ระบบปฏิบัติการ | Windows 10/11, Windows Server 2019+ หรือ Linux | — |
| CPU / RAM | 2 core / 4 GB | 4 core / 8 GB |
| พื้นที่ว่าง | 5 GB | 20 GB (ถ้าผู้ใช้บันทึกแฟ้มผลรายงานเยอะ) |
| เครือข่าย | ต่อเซิร์ฟเวอร์ HIS ที่ port 3306 ได้ | IP คงที่ |

### 1.2 ข้อมูลจากฝั่ง HIS
- **ที่อยู่ฐาน HIS**: IP / port / ชื่อฐาน (ค่าเริ่มต้นของระบบคือฐาน `hi`)
- **ผู้ใช้ฐานข้อมูลสำหรับอ่าน** (แนะนำให้สร้างใหม่ ดูข้อ 1.3)
- **ชื่อฐานของคิวรี่เดิม** (ค่าเริ่มต้น `reportdb`): ใช้ตอนนำเข้ารายงานเดิมจาก `rep_query_item` ถ้าไม่มีให้ข้ามได้

### 1.3 สร้างผู้ใช้ HIS แบบอ่านอย่างเดียว (แนะนำมาก)
รันบนเซิร์ฟเวอร์ HIS ด้วยผู้ใช้ที่มีสิทธิ์จัดการ แทน `<IP เซิร์ฟเวอร์รายงาน>` และ `<รหัสผ่าน>`

```sql
CREATE USER 'hisreport_ro'@'<IP เซิร์ฟเวอร์รายงาน>' IDENTIFIED BY '<รหัสผ่าน>';
GRANT SELECT ON hi.*       TO 'hisreport_ro'@'<IP เซิร์ฟเวอร์รายงาน>';
GRANT SELECT ON reportdb.* TO 'hisreport_ro'@'<IP เซิร์ฟเวอร์รายงาน>';   -- ถ้ามีฐานคิวรี่เดิม
FLUSH PRIVILEGES;
```

ระบบตั้งการเชื่อมต่อ HIS เป็น `READ ONLY` อยู่แล้ว และยอมรับเฉพาะคำสั่ง `SELECT` แต่การใช้ผู้ใช้ที่มีสิทธิ์ SELECT อย่างเดียวช่วยป้องกันอีกชั้น
**อย่าใช้ผู้ใช้ที่มีสิทธิ์เขียนหรือสิทธิ์ ALL**

### 1.4 ทดสอบว่าเซิร์ฟเวอร์รายงานต่อ HIS ได้
Windows (PowerShell):
```powershell
Test-NetConnection <IP HIS> -Port 3306      # TcpTestSucceeded ต้องเป็น True
```
Linux: `nc -vz <IP HIS> 3306`

---

## 2. เลือกวิธีติดตั้ง

| | วิธี A: Docker (แนะนำ) | วิธี B: ติดตั้งตรงบน Windows |
|---|---|---|
| เหมาะกับ | เครื่องใหม่ / Linux / ต้องการดูแลง่าย | เครื่องที่มี MySQL อยู่แล้ว (เช่น AppServ) และติดตั้ง Docker ไม่ได้ |
| ฐานของระบบ | มาพร้อม (MySQL 8 ใน container) | ใช้ MySQL 8 ที่มีบนเครื่อง |
| เปิดเองหลังรีสตาร์ท | มีให้ในตัว | ต้องตั้ง service เอง (ข้อ B6) |
| อัปเดต | คำสั่งเดียว | หลายขั้นตอน |

ก่อนทั้งสองวิธี ให้ดาวน์โหลดโค้ด
```powershell
git clone https://github.com/weaknesspays/hisreport-app.git
cd hisreport-app
```
(repo เป็น private ต้องได้รับสิทธิ์เข้าถึงก่อน หรือขอไฟล์ zip จากผู้พัฒนา)

---

## วิธี A: ติดตั้งด้วย Docker

### A1. ติดตั้ง Docker
- **Windows**: Docker Desktop (ใช้ WSL 2) → เปิดโปรแกรม → Settings → General → เปิด "Start Docker Desktop when you sign in"
- **Linux**: Docker Engine + Docker Compose plugin

ตรวจด้วย `docker compose version`

### A2. ตั้งค่า
```powershell
copy .env.docker.example .env.docker      # Linux: cp .env.docker.example .env.docker
notepad .env.docker                       # Linux: nano .env.docker
```
กรอกค่าตามตารางในข้อ 3 โดย `APP_DB_PASSWORD` กับ `MYSQL_PASSWORD` ต้องเป็นค่าเดียวกัน

### A3. เปิดระบบ
```powershell
docker compose up -d --build
docker compose ps            # รอจน app เป็น "healthy" (~1–2 นาที)
```
- **build ครั้งแรก**: ใช้เวลา 5–15 นาที และต้องต่ออินเทอร์เน็ต
- **ทุกครั้งที่ container เริ่ม**: ระบบสร้างตารางที่ยังไม่มีและบัญชีผู้ดูแลให้อัตโนมัติ

**ฐาน hisreport_app อยู่เซิร์ฟเวอร์อื่น** (ไม่ใช้ MySQL ใน container)
1. ตั้ง `APP_DB_HOST=<IP>` ใน `.env.docker`
2. รัน `docker compose -f docker-compose.external-db.yml up -d --build`

ขั้นตอนฝั่งเซิร์ฟเวอร์ฐานข้อมูลดูข้อ 4.1 ใน [DOCKER.md](DOCKER.md)

ไปต่อที่ **ข้อ 4 ใช้งานครั้งแรก**
รายละเอียดเพิ่มเติม (ย้ายข้อมูลเดิม สำรองข้อมูล แก้ปัญหา) ดูใน [DOCKER.md](DOCKER.md)

---

## วิธี B: ติดตั้งตรงบน Windows

### B1. ติดตั้งโปรแกรม
- **Node.js 22 LTS** (https://nodejs.org) ตรวจด้วย `node -v`
- **MySQL 8.0** ถ้ายังไม่มี (หรือใช้ของ AppServ ที่เป็น 8.0)

### B2. สร้างฐานของระบบ
1. เปิด `db\00_create_db_and_user.sql` แล้วแก้ `CHANGE_ME` (2 จุด) เป็นรหัสผ่านใหม่
2. รันด้วยผู้ใช้ root ของ MySQL:
   ```powershell
   Get-Content db\00_create_db_and_user.sql | & "C:\AppServ\MySQL\bin\mysql.exe" -u root -p
   ```
   (แก้ path ของ `mysql.exe` ให้ตรงเครื่อง หรือรันไฟล์นี้ผ่าน phpMyAdmin)

### B3. ตั้งค่า
```powershell
copy .env.example .env.local
notepad .env.local
```
กรอกค่าตามตารางในข้อ 3
- `APP_DB_HOST=127.0.0.1`
- `APP_DB_USER=hisreport`
- `APP_DB_PASSWORD` = รหัสที่ตั้งในข้อ B2

### B4. ติดตั้งและสร้างตาราง
```powershell
npm ci
npm run db:migrate          # สร้างตาราง + Role เริ่มต้น + ผู้ดูแล admin
npm run build
```

### B5. ทดลองเปิด
```powershell
npm start
```
เปิด http://localhost:3000/hisreport-app แล้วกด Ctrl+C เพื่อหยุดก่อนทำข้อ B6

### B6. ให้ระบบเปิดเองเมื่อรีสตาร์ทเครื่อง (Windows Service ด้วย NSSM)
1. ดาวน์โหลด NSSM (https://nssm.cc) แตกไฟล์ไว้ เช่น `C:\nssm`
2. เปิด PowerShell แบบ Administrator:
   ```powershell
   $app = "C:\path\to\hisreport-app"      # โฟลเดอร์ของระบบ
   C:\nssm\win64\nssm.exe install HISReport "C:\Program Files\nodejs\node.exe" "node_modules\next\dist\bin\next start -p 3000"
   C:\nssm\win64\nssm.exe set HISReport AppDirectory $app
   C:\nssm\win64\nssm.exe set HISReport AppEnvironmentExtra TZ=Asia/Bangkok
   C:\nssm\win64\nssm.exe set HISReport AppStdout "$app\logs\out.log"
   C:\nssm\win64\nssm.exe set HISReport AppStderr "$app\logs\err.log"
   New-Item -ItemType Directory -Force "$app\logs" | Out-Null
   Start-Service HISReport
   ```
   ระบบอ่าน `.env.local` จากโฟลเดอร์ของระบบเอง

### B7. เปิด Firewall ให้เครื่องอื่นเข้าได้
```powershell
New-NetFirewallRule -DisplayName "HIS Report 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

⚠️ **อย่าวางโฟลเดอร์ระบบไว้ใต้ `C:\AppServ\www`** (หรือโฟลเดอร์ที่ Apache เสิร์ฟ) เพราะ Apache จะเปิดให้ดาวน์โหลด `.env.local` ซึ่งมีรหัสผ่านได้

---

## 3. ค่าในไฟล์ตั้งค่า (`.env.docker` หรือ `.env.local`)

| ค่า | ความหมาย | ตัวอย่าง |
|---|---|---|
| `APP_DB_HOST` / `APP_DB_PORT` | **ที่อยู่ฐานของระบบ (hisreport_app)**: Windows ใช้ `127.0.0.1`, Docker ใช้ `db`, ฐานอยู่เครื่องอื่นใส่ IP ของเครื่องนั้น | `127.0.0.1` / `3306` |
| `APP_DB_USER` / `APP_DB_PASSWORD` / `APP_DB_NAME` | ผู้ใช้และฐานของระบบ | `hisreport` / … / `hisreport_app` |
| `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` | **Docker เท่านั้น**: รหัสของ MySQL ใน container | |
| `HIS_DB_HOST` / `HIS_DB_PORT` | เซิร์ฟเวอร์ HIS | `10.0.0.8` / `3306` |
| `HIS_DB_USER` / `HIS_DB_PASSWORD` | ผู้ใช้อ่านอย่างเดียวจากข้อ 1.3 | `hisreport_ro` / … |
| `HIS_DB_NAME` | ฐาน HIS | `hi` |
| `HIS_LEGACY_SCHEMA` | ฐานคิวรี่เดิม (rep_query_item) | `reportdb` |
| `HIS_MAX_CONCURRENT` | จำนวนรายงานที่คิวรี่ HIS พร้อมกันได้ (รวมทุกผู้ใช้) | `2` |
| `SESSION_SECRET` | ข้อความสุ่มอย่างน้อย 32 ตัว ใช้เข้ารหัส session | ดูวิธีสร้างด้านล่าง |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | ผู้ดูแลระบบเริ่มต้น (บัญชีในระบบเอง ไม่ใช่บัญชี HIS) | `admin` / … |
| `HOSPITAL_NAME` | ชื่อหน่วยงาน แสดงหน้า login และหัวไฟล์ Excel | `โรงพยาบาล…` |
| `SAVED_MAX_FILES` / `SAVED_MAX_MB` | โควตาแฟ้มผลรายงานต่อผู้ใช้ | `50` / `200` |

สร้าง `SESSION_SECRET` (PowerShell):
```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

- **ไฟล์ตั้งค่ามีรหัสผ่าน**: ห้ามส่งต่อ ห้ามใส่ใน git (มี `.gitignore` กันไว้แล้ว)
- **`ADMIN_PASSWORD`**: ใช้ครั้งเดียวตอนสร้างบัญชี admin ครั้งแรก ถ้าแก้ภายหลัง รหัสใน admin ที่สร้างไปแล้วจะไม่เปลี่ยน

---

## 4. ใช้งานครั้งแรก
1. เปิด `http://<เครื่องเซิร์ฟเวอร์>:3000/hisreport-app` แล้วเข้าสู่ระบบด้วย `ADMIN_USERNAME` / `ADMIN_PASSWORD`
2. **จัดการรายงาน → นำเข้าจาก rep_query_item**: นำเข้าคิวรี่เดิม (ถ้ามี)
   - คิวรี่ที่ SQL เสียหรือตัวแปรไม่ครบ จะถูกตั้งเป็น "ร่าง" ให้แก้ก่อนเผยแพร่
3. **หัวข้อรายงาน**: เปลี่ยนชื่อกลุ่มที่นำเข้ามาให้สื่อความหมาย จัดหมวด และเรียงลำดับ
4. **ผู้ใช้และสิทธิ์ → กลุ่มสิทธิ์ (Role)**: ติ๊กว่า Role ไหนเห็นหัวข้อรายงานไหน และสิทธิ์พิเศษ (Export, ดูข้อมูลบุคคล, สร้างรายงาน)
5. **ผู้ใช้**: ค้นหาผู้ใช้จาก HIS แล้วกำหนด Role
   - ผู้ใช้ที่ login ด้วยบัญชี HIS ครั้งแรก ระบบจะสร้างบัญชีให้อัตโนมัติ แต่**ยังไม่มี Role** จึงยังไม่เห็นรายงานจนกว่าผู้ดูแลจะกำหนด
6. **ทดสอบ**: ลอง login ด้วยบัญชี HIS ของเจ้าหน้าที่จริง 1 คน แล้วเปิดรายงานดู

**การ login ด้วยบัญชี HIS**: ระบบตรวจจากตาราง `dct` ในฐาน HIS ถ้า HIS ของหน่วยงานใช้โครงสร้างหรือวิธีเก็บรหัสผ่านต่างออกไป login ด้วยบัญชี HIS จะไม่ผ่าน (บัญชี admin ยังใช้ได้เสมอ) ให้ติดต่อผู้พัฒนา

---

## 5. ตรวจสอบก่อนใช้งานจริง
- [ ] ใช้ผู้ใช้ HIS ที่มีสิทธิ์ **SELECT อย่างเดียว** (ข้อ 1.3)
- [ ] เปลี่ยน `ADMIN_PASSWORD` และ `SESSION_SECRET` จากค่าตัวอย่างแล้ว
- [ ] ฐานของระบบใช้ผู้ใช้ `hisreport` ไม่ใช่ `root`
- [ ] เปิด port 3000 เฉพาะเครือข่ายภายในโรงพยาบาล ห้ามเปิดออกอินเทอร์เน็ต
- [ ] อัปเดต Next.js เป็นรุ่นที่แก้ช่องโหว่แล้ว (`npm ls next` ต้องไม่ใช่ 15.5.4 เพราะมีช่องโหว่ CVE-2025-66478)
- [ ] ตั้งการสำรองฐาน `hisreport_app` ประจำวัน (ข้อ 6)
- [ ] ระบบเปิดเองหลังรีสตาร์ทเครื่อง (Docker: restart policy / Windows: service ข้อ B6)

---

## 6. ดูแลระบบ

### สำรองข้อมูล (ฐานของระบบเท่านั้น ฐาน HIS ไม่เกี่ยว)
- **Docker**:
  ```powershell
  docker compose exec db sh -c 'mysqldump -uroot -p$MYSQL_ROOT_PASSWORD --single-transaction --default-character-set=utf8mb4 hisreport_app > /tmp/backup.sql'
  docker compose cp db:/tmp/backup.sql .\backup-hisreport.sql
  ```
- **Windows**:
  ```powershell
  & "C:\AppServ\MySQL\bin\mysqldump.exe" -u root -p --single-transaction --no-tablespaces --default-character-set=utf8mb4 --result-file=backup-hisreport.sql hisreport_app
  ```
  ใช้ `--result-file` อย่าใช้ `>` ใน PowerShell 5 เพราะภาษาไทยจะเสีย
- **ไฟล์สำรองมีข้อมูลผู้ใช้และแฟ้มที่อาจมีข้อมูลผู้ป่วย**: เก็บในที่ปลอดภัย

### อัปเดตเป็นรุ่นใหม่
- **Docker**:
  ```powershell
  git pull
  docker compose up -d --build
  ```
- **Windows**:
  ```powershell
  git pull
  npm ci
  npm run db:migrate
  npm run build
  Restart-Service HISReport
  ```

`db:migrate` ทำซ้ำได้ปลอดภัย ไม่ลบข้อมูลเดิม

### ดู log
- **Docker**: `docker compose logs -f app`
- **Windows service**: ไฟล์ใน `logs\`
- **ประวัติการใช้งานของผู้ใช้** (เปิดรายงาน, Export, login ผิด): เมนู **ประวัติการใช้งาน** ในระบบ

---

## 7. แก้ปัญหาที่พบบ่อย
| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| หน้า login ขึ้น "เชื่อมต่อฐานข้อมูลของระบบไม่ได้" | รหัส/ผู้ใช้ของฐาน `hisreport_app` ไม่ตรงกับไฟล์ตั้งค่า หรือ MySQL ไม่ได้เปิด |
| "เชื่อมต่อฐานข้อมูล HIS ไม่ได้ในขณะนี้" | เซิร์ฟเวอร์รายงานต่อ HIS ไม่ได้ → ทดสอบตามข้อ 1.4 / ตรวจ firewall ฝั่ง HIS / ตรวจว่าผู้ใช้ HIS อนุญาต IP นี้ |
| login บัญชี HIS ไม่ได้ แต่รหัสถูก | บัญชีถูกระงับใน HIS หรือใส่ผิดเกิน 5 ครั้ง (ล็อก 15 นาที) → ดูเมนูประวัติการใช้งาน |
| login ได้แต่ไม่เห็นรายงาน | ผู้ใช้ยังไม่มี Role หรือ Role ยังไม่ได้ติ๊กหัวข้อรายงาน (ข้อ 4) |
| รายงานขึ้น "ใช้เวลาเกิน … วินาที" | ลดช่วงวันที่ หรือผู้ดูแลเพิ่มเวลาในหน้าแก้ไขรายงาน → แท็บประสิทธิภาพ |
| "มีรายงานอื่นกำลังประมวลผลอยู่หลายรายการ" | มีคนประมวลผลรายงานหนักพร้อมกันมาก รอสักครู่ หรือเพิ่ม `HIS_MAX_CONCURRENT` (ระวังภาระของ HIS) |
| เครื่องอื่นเปิดเว็บไม่ได้ แต่เครื่องเซิร์ฟเวอร์เปิดได้ | Firewall ยังไม่เปิด port 3000 (ข้อ B7) |
| port 3000 ถูกใช้ | มีโปรแกรมอื่นใช้อยู่ → ปิดโปรแกรมนั้น หรือเปลี่ยน port (Docker: แก้ `docker-compose.yml`, Windows: แก้ `-p 3000` ในคำสั่ง service) |
