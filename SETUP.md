# ติดตั้งระบบรายงาน HIS (hisreport-app)

## 1. สร้างฐานข้อมูลของระบบ (ครั้งเดียว)
1. เปิด `db/00_create_db_and_user.sql` เปลี่ยน `CHANGE_ME` เป็นรหัสผ่านที่ต้องการ
2. รันด้วยผู้ใช้ root ของ MySQL บนเครื่องนี้ (phpMyAdmin หรือ `mysql -u root -p < db\00_create_db_and_user.sql`)
3. ใส่รหัสผ่านเดียวกันใน `.env.local` บรรทัด `APP_DB_PASSWORD=`

## 2. สร้างตารางและผู้ดูแลระบบ
```
cd C:\AppServ\hisreport-app
npm run db:migrate
```
ผู้ดูแลระบบเริ่มต้น: ชื่อผู้ใช้ `admin` รหัสผ่านอยู่ใน `.env.local` → `ADMIN_PASSWORD` (สุ่มให้แล้ว เปลี่ยนได้ก่อนรัน migrate)

## 3. รันระบบ
```
npm run build
npm start
```
เปิด http://localhost:3000/hisreport-app

## 4. ใช้งานครั้งแรก
1. เข้าสู่ระบบด้วย `admin`
2. **จัดการรายงาน → นำเข้าจาก rep_query_item** (ต้องเชื่อม HIS 10.0.0.8 ได้)
3. **หัวข้อรายงาน** — เปลี่ยนชื่อกลุ่มที่นำเข้า (`กลุ่มเดิม #…`) ให้สื่อความหมาย
4. **ผู้ใช้และสิทธิ์** — กำหนดว่า Role ไหนเห็นหัวข้อไหน แล้วเพิ่มผู้ใช้

## 5. เข้าใช้งานจากเครื่องอื่น
ระบบรันแยกที่ port 3000 (ไม่ยุ่งกับ Apache port 88)
→ http://<IP เครื่องนี้>:3000/hisreport-app
ถ้าเครื่องอื่นเข้าไม่ได้ ให้เปิด Windows Firewall ขาเข้า TCP 3000

## 6. (แนะนำ) ให้ระบบเปิดเองเมื่อเครื่องรีสตาร์ท
ใช้ PM2 (`npm i -g pm2 pm2-windows-startup`) หรือ NSSM ติดตั้ง `npm start` เป็น Windows Service
