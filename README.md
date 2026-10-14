# HIS Report2570 — ระบบรายงานจากฐานข้อมูล HIS

เว็บแอปสำหรับดูรายงานจากฐาน HIS ของโรงพยาบาล ผู้ดูแลสร้างรายงานจาก SQL เองได้ และกำหนดสิทธิ์ตาม Role × หัวข้อรายงาน

- **ฐาน HIS อ่านอย่างเดียว**: เชื่อมต่อแบบ `READ ONLY` และรับเฉพาะคำสั่ง `SELECT`
- **login ด้วยบัญชี HIS**: กำหนดสิทธิ์ตาม Role และบันทึกการใช้งานทุกครั้ง (audit log)
- **รายงาน**: ตาราง / ตัวเลข / กราฟ (วิเคราะห์ชนิดข้อมูลอัตโนมัติ) / Export Excel / ปิดบังข้อมูลส่วนบุคคลตามสิทธิ์
- **Dashboard**: ประมวลผลทีละรายงาน ไม่เพิ่มภาระ HIS
- **แฟ้มผลรายงาน**: บันทึกผลไว้เปิดดูภายหลังโดยไม่ต้องคิวรี่ใหม่
- **นำเข้าคิวรี่เดิม**: จาก `reportdb.rep_query_item`

## เอกสาร
| เอกสาร | เนื้อหา |
|---|---|
| [INSTALL.md](INSTALL.md) | **คู่มือติดตั้ง** (Docker หรือ Windows), ค่าตั้ง, ใช้งานครั้งแรก, สำรองข้อมูล, แก้ปัญหา |
| [DOCKER.md](DOCKER.md) | รายละเอียด Docker และการย้ายข้อมูลเดิม |
| [CLAUDE.md](CLAUDE.md) | บันทึกทางเทคนิคสำหรับผู้พัฒนา |

## พัฒนา
```bash
npm ci
cp .env.example .env.local     # แล้วกรอกค่า
npm run db:migrate
npm run dev                    # http://localhost:3000/hisreport-app
npx tsc --noEmit && npx eslint src
```

Stack: Next.js 15 (App Router) · TypeScript · Tailwind v4 + shadcn/ui · mysql2 · recharts · exceljs
