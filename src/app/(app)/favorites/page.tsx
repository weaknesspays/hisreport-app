import { requireUser } from "@/lib/auth";
import { rows } from "@/lib/db";
import { ReportList, type ReportListItem } from "@/components/report/report-list";
import { thaiDate } from "@/lib/dates";

export const metadata = { title: "รายงานโปรด / ล่าสุด" };

export default async function FavoritesPage() {
  const user = await requireUser();
  const groupFilter = user.isAdmin ? "" : user.groupIds.length ? `AND r.group_id IN (${user.groupIds.join(",")})` : "AND 0";
  const fav = await rows<ReportListItem>(
    `SELECT r.id, r.name, r.description, g.name AS group_name, r.has_person_data
     FROM user_favorite f JOIN report r ON r.id = f.report_id LEFT JOIN report_group g ON g.id = r.group_id
     WHERE f.user_id = ? AND r.status = 'published' ${groupFilter} ORDER BY f.created_at DESC`, [user.id]);
  const recent = await rows<ReportListItem & { opened_at: string }>(
    `SELECT r.id, r.name, r.description, g.name AS group_name, r.has_person_data, x.opened_at
     FROM user_recent x JOIN report r ON r.id = x.report_id LEFT JOIN report_group g ON g.id = r.group_id
     WHERE x.user_id = ? AND r.status = 'published' ${groupFilter} ORDER BY x.opened_at DESC LIMIT 12`, [user.id]);
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">รายงานโปรด</h1>
        <ReportList items={fav} showGroup empty="ยังไม่มี — กด “เพิ่มรายงานโปรด” ในหน้ารายงาน" />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">เปิดล่าสุด <span className="text-sm font-normal text-muted-foreground">(จำเงื่อนไขล่าสุดไว้ให้)</span></h2>
        <ReportList items={recent.map((r) => ({ ...r, extra: `เปิดเมื่อ ${thaiDate(r.opened_at, true)}` }))} showGroup empty="ยังไม่มี" />
      </section>
    </div>
  );
}
