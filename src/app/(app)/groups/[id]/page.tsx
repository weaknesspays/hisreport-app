import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one, rows } from "@/lib/db";
import { listReports } from "@/lib/reports";
import { ReportList } from "@/components/report/report-list";
import { SortableReportList } from "@/components/report/sortable-report-list";
import { GroupIcon } from "@/components/app-shell/icons";

export default async function GroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  const { q } = await searchParams;
  if (!user.groupIds.includes(id)) notFound();
  const g = await one<{ name: string; icon: string; description: string | null }>("SELECT name, icon, description FROM report_group WHERE id=?", [id]);
  if (!g) notFound();
  const items = await listReports({ groupId: id, publishedOnly: true, q: q?.trim() || undefined });
  // ลำดับที่ผู้ใช้ลากจัดไว้ (ของใครของมัน) — รายงานที่ยังไม่เคยจัดต่อท้ายตามชื่อ
  const saved = await rows<{ report_id: number; sort: number }>("SELECT report_id, sort FROM user_report_order WHERE user_id = ? AND group_id = ?", [user.id, id]);
  const pos = new Map(saved.map((x) => [x.report_id, x.sort]));
  const ordered = items.map((r, i) => ({ r, k: pos.get(r.id) ?? 1e6 + i })).sort((a, b) => a.k - b.k).map((x) => x.r);
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><GroupIcon name={g.icon} className="size-5" /></div>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">{g.name}</h1>
          {g.description && <p className="text-sm text-muted-foreground">{g.description}</p>}
        </div>
      </div>
      <form className="max-w-sm"><input name="q" defaultValue={q} placeholder="ค้นหารายงานในหัวข้อนี้" className="h-9 w-full rounded-md border bg-transparent px-3 text-sm" /></form>
      {q?.trim()
        ? <ReportList items={ordered} empty="ไม่พบรายงานตามคำค้น" />
        : <SortableReportList key={ordered.map((r) => r.id).join(",")} groupId={id} items={ordered} customized={saved.length > 0} empty="ยังไม่มีรายงานที่เผยแพร่ในหัวข้อนี้" />}
    </div>
  );
}
