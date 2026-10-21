import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/change-password-form";
import { LogoutButton } from "./logout-button";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: "ตั้งรหัสผ่านใหม่" };

/** บังคับเปลี่ยนรหัส (บัญชี local ที่ผู้ดูแลตั้ง/รีเซ็ตรหัสให้) — requireUser() ของทุกหน้าส่งมาที่นี่ */
export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect("/");
  return (
    <main className="relative grid min-h-dvh place-items-center p-4" style={{ background: "var(--login-bg)" }}>
      <div className="w-full max-w-[400px] rounded-[14px] bg-card p-7 shadow-[0_20px_50px_rgb(0_0_0/25%)]">
        <div className="flex items-center gap-2.5">
          <div className="grid size-[34px] place-items-center rounded-lg bg-logo text-[15px] font-bold text-white">HR</div>
          <div className="leading-tight"><div className="text-lg font-bold">{APP_NAME}</div><div className="text-xs text-muted-foreground">{process.env.HOSPITAL_NAME}</div></div>
        </div>
        <h1 className="mb-1 mt-4 text-2xl font-bold">ตั้งรหัสผ่านใหม่</h1>
        <p className="mb-4 text-sm text-muted-foreground">สวัสดี {user.displayName} — รหัสผ่านนี้ผู้ดูแลระบบตั้งให้ กรุณาตั้งรหัสใหม่ของคุณเองก่อนเริ่มใช้งาน</p>
        <ChangePasswordForm username={user.username} after="/" />
        <div className="mt-4 text-center"><LogoutButton /></div>
      </div>
    </main>
  );
}
