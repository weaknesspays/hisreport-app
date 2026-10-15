import type { Metadata, Viewport } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "ระบบรายงานจากฐานข้อมูล HIS",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// ใช้ชุดสีที่เก็บไว้ในเบราว์เซอร์ก่อนแสดงผล (กันจอกระพริบ) เมื่อ server ไม่รู้ค่าของผู้ใช้
const colorScript = `try{var h=document.documentElement;if(!h.dataset.color){var c=localStorage.getItem('hr-color');h.dataset.color=c||'blue'}}catch(e){}`;

// เบราว์เซอร์เก่ากว่า Chrome/Edge 111 (มี.ค. 2023) ไม่รองรับ CSS ที่ Tailwind v4 ใช้ (color-mix ฯลฯ) — ปุ่ม/สีบางส่วนหายได้
// เขียนเป็น script ธรรมดา (ไม่พึ่ง React/Tailwind) ให้ทำงานได้แม้หน้าเว็บส่วนอื่นพัง
const oldBrowserScript = `try{if(!(window.CSS&&CSS.supports&&CSS.supports('color','color-mix(in srgb, red, blue)'))){var d=document.createElement('div');d.setAttribute('role','alert');d.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:10px 16px;background:#fff3cd;color:#664d03;border-top:1px solid #e0c36b;font:14px Tahoma,sans-serif;text-align:center';d.textContent='เบราว์เซอร์นี้เก่าเกินไป บางปุ่มอาจไม่แสดง (เช่น Excel) กรุณาอัปเดต Google Chrome หรือ Microsoft Edge เป็นรุ่น 111 ขึ้นไป';document.body.appendChild(d)}}catch(e){}`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser().catch(() => null);
  return (
    <html lang="th" data-color={user?.color} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: colorScript }} />
      </head>
      <body className={`${sarabun.variable} font-sans antialiased`}>
        <Providers serverTheme={user?.theme ?? null} serverColor={user?.color ?? null} loggedIn={!!user}>
          {children}
        </Providers>
        <script dangerouslySetInnerHTML={{ __html: oldBrowserScript }} />
      </body>
    </html>
  );
}
