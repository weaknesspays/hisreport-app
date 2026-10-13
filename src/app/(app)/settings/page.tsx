import { requireUser } from "@/lib/auth";
import { ThemeSettings } from "@/components/theme/theme-settings";

export const metadata = { title: "ตั้งค่าการแสดงผล" };

export default async function SettingsPage() {
  await requireUser();
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold sm:text-2xl">ตั้งค่าการแสดงผล</h1>
      <p className="text-sm text-muted-foreground">ระบบจำค่าที่เลือกไว้กับบัญชีของคุณ — เปิดจากเครื่องอื่นก็ได้ธีมเดิม</p>
      <ThemeSettings />
    </div>
  );
}
