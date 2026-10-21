import { requireUser } from "@/lib/auth";
import { ThemeSettings } from "@/components/theme/theme-settings";
import { ChangePasswordForm } from "@/components/change-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "ตั้งค่า" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold sm:text-2xl">ตั้งค่า</h1>
      <p className="text-sm text-muted-foreground">ระบบจำค่าที่เลือกไว้กับบัญชีของคุณ — เปิดจากเครื่องอื่นก็ได้ธีมเดิม</p>
      <ThemeSettings />
      <Card id="password">
        <CardHeader>
          <CardTitle className="text-base">รหัสผ่าน</CardTitle>
          <CardDescription>
            {user.authSource === "local"
              ? "บัญชีในระบบนี้ — เปลี่ยนรหัสผ่านได้ที่นี่ (เครื่องอื่นที่เข้าสู่ระบบค้างไว้จะต้องเข้าสู่ระบบใหม่)"
              : "คุณเข้าสู่ระบบด้วยบัญชี HIS — เปลี่ยนรหัสผ่านในโปรแกรม HIS แล้วใช้รหัสใหม่กับระบบนี้ได้ทันที"}
          </CardDescription>
        </CardHeader>
        {user.authSource === "local" && <CardContent className="max-w-sm"><ChangePasswordForm username={user.username} /></CardContent>}
      </Card>
    </div>
  );
}
