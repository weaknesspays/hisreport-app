-- รันไฟล์นี้ครั้งเดียวด้วยผู้ใช้ root ของ MySQL บนเครื่องนี้ (127.0.0.1:3306)
-- เปลี่ยน 'CHANGE_ME' เป็นรหัสผ่านที่ต้องการ แล้วใส่รหัสเดียวกันใน .env.local (APP_DB_PASSWORD)

CREATE DATABASE IF NOT EXISTS hisreport_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'hisreport'@'localhost' IDENTIFIED BY 'CHANGE_ME';
CREATE USER IF NOT EXISTS 'hisreport'@'127.0.0.1' IDENTIFIED BY 'CHANGE_ME';

-- สิทธิ์เฉพาะฐานของระบบรายงานเท่านั้น
GRANT ALL PRIVILEGES ON hisreport_app.* TO 'hisreport'@'localhost';
GRANT ALL PRIVILEGES ON hisreport_app.* TO 'hisreport'@'127.0.0.1';
FLUSH PRIVILEGES;
