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
      </body>
    </html>
  );
}
