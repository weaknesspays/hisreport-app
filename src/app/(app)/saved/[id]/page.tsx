import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadSaved, SavedError } from "@/lib/saved";
import { audit } from "@/lib/audit";
import { SavedViewer } from "@/components/saved/saved-viewer";

export const metadata = { title: "แฟ้มที่บันทึกไว้" };

export default async function SavedFilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  let s;
  try {
    s = await loadSaved(user, id);
  } catch (e) {
    if (e instanceof SavedError && e.status === 403) {
      return (
        <div className="mx-auto max-w-lg py-16 text-center">
          <ShieldAlert className="mx-auto mb-3 size-10 text-destructive" />
          <h1 className="text-xl font-semibold">{e.message}</h1>
          <p className="mt-2 text-muted-foreground">ติดต่อผู้ดูแลระบบถ้าต้องการสิทธิ์คืน หรือ <Link href="/saved" className="text-primary hover:underline">กลับไปหน้าแฟ้ม</Link></p>
        </div>
      );
    }
    if (e instanceof SavedError) notFound();
    throw e;
  }
  await audit({ userId: user.id, action: "view_saved", reportId: s.report_id, rowCount: s.row_count, detail: `#${s.id}: ${s.name}` });

  // ส่งเฉพาะที่หน้าจอใช้ (ไม่ส่ง SQL ให้ผู้ใช้ที่ไม่มีสิทธิ์สร้างรายงาน)
  const { sql, ...rest } = s;
  return <SavedViewer saved={{ ...rest, sql: user.isAdmin || user.canAuthor ? sql : null }} canExport={user.canExport} />;
}
