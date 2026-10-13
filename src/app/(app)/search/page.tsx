import { requireUser } from "@/lib/auth";
import { listReports } from "@/lib/reports";
import { ReportList } from "@/components/report/report-list";

export const metadata = { title: "ค้นหารายงาน" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const q = ((await searchParams).q || "").trim();
  const items = q ? await listReports({ q, publishedOnly: true, groupIds: user.isAdmin ? undefined : user.groupIds }) : [];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">ผลการค้นหา “{q}” <span className="text-base font-normal text-muted-foreground">({items.length})</span></h1>
      <ReportList items={items} showGroup empty="ไม่พบรายงาน (แสดงเฉพาะรายงานในหัวข้อที่คุณมีสิทธิ์)" />
    </div>
  );
}
