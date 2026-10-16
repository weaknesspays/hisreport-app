import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { allGroups, listReports } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { ImportLegacyButton } from "@/components/admin/import-legacy";
import { ReportsTable } from "@/components/admin/reports-table";

export const metadata = { title: "จัดการรายงาน" };

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ q?: string; group?: string; status?: string }> }) {
  const user = await requireUser();
  if (!user.isAdmin && !user.canAuthor) redirect("/");
  const sp = await searchParams;
  const groups = await allGroups();
  const items = await listReports({
    q: sp.q?.trim() || undefined,
    groupId: sp.group ? Number(sp.group) : undefined,
    status: sp.status || undefined,
    groupIds: user.isAdmin ? undefined : user.groupIds,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">จัดการรายงาน</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          {user.isAdmin && <ImportLegacyButton />}
          <Button asChild><Link href="/admin/reports/new"><Plus /> สร้างรายงานใหม่</Link></Button>
        </div>
      </div>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="ค้นหาชื่อ / นิยาม / รหัส" className="h-9 w-64 rounded-md border bg-transparent px-3 text-sm" />
        <select name="group" defaultValue={sp.group ?? ""} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">ทุกหัวข้อ</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">ทุกสถานะ</option>
          <option value="published">เผยแพร่</option>
          <option value="draft">ร่าง</option>
          <option value="disabled">ปิดใช้งาน</option>
        </select>
        <Button type="submit" variant="outline" size="sm" className="h-9">กรอง</Button>
        <span className="self-center text-sm text-muted-foreground">{items.length} รายงาน</span>
      </form>
      <ReportsTable items={items} />
    </div>
  );
}
