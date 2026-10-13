import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { ThemeMenu } from "@/components/theme/theme-menu";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser().catch(() => null)) redirect("/");
  const { next } = await searchParams;
  return (
    <main className="relative grid min-h-dvh place-items-center p-4" style={{ background: "var(--login-bg)" }}>
      <div className="absolute right-4 top-4 text-white"><ThemeMenu /></div>
      <div className="w-full max-w-[380px] rounded-[14px] bg-card p-7 shadow-[0_20px_50px_rgb(0_0_0/25%)]">
        <div className="flex items-center gap-2.5">
          <div className="grid size-[34px] place-items-center rounded-lg bg-logo text-[15px] font-bold text-white">HR</div>
          <div className="leading-tight">
            <div className="text-lg font-bold">{APP_NAME}</div>
            <div className="text-xs text-muted-foreground">{process.env.HOSPITAL_NAME}</div>
          </div>
        </div>
        <h1 className="mb-0.5 mt-4 text-2xl font-bold">เข้าสู่ระบบ</h1>
        <LoginForm next={next && next.startsWith("/") && !next.startsWith("//") ? next : "/"} />
      </div>
    </main>
  );
}
