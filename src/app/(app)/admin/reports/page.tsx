import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { allGroups, listReports } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ImportLegacyButton } from "@/components/admin/import-legacy";
import { thaiDate } from "@/lib/dates";

export const metadata = { title: "จัดการรายงาน" };

const STATUS = {
  published: { label: "เผยแพร่", cls: "border-success/40 text-success" },
  draft: { label: "ร่าง", cls: "border-warning/50 text-warning" },
  disabled: { label: "ปิดใช้งาน", cls: "text-muted-foreground" },
};

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
      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead className="w-14">#</TableHead><TableHead>ชื่อรายงาน</TableHead><TableHead>หัวข้อ</TableHead><TableHead>สถานะ</TableHead><TableHead>แก้ไขล่าสุด</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => {
                const st = STATUS[r.status];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">{r.id}</TableCell>
                    <TableCell className="max-w-md">
                      <Link href={`/admin/reports/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                      {r.legacy_query_id && <span className="ml-1 text-xs text-muted-foreground">(เดิม #{r.legacy_query_id})</span>}
                      {!!r.has_person_data && <Badge variant="outline" className="ml-1 border-destructive/40 text-destructive">บุคคล</Badge>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{r.group_name ?? "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="outline" className={st.cls}>{st.label}{r.published_version ? ` v${r.published_version}` : ""}</Badge>
                      {r.published_version !== null && r.latest_version > r.published_version && <Badge variant="outline" className="ml-1 border-warning/50 text-warning">ร่าง v{r.latest_version}</Badge>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{thaiDate(r.updated_at, true)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button variant="ghost" size="sm" asChild><Link href={`/admin/reports/${r.id}`}>แก้ไข</Link></Button>
                      <Button variant="ghost" size="sm" asChild><Link href={`/reports/${r.id}`}>เปิด</Link></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!items.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">ยังไม่มีรายงาน — สร้างใหม่ หรือ นำเข้าจาก rep_query_item</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
