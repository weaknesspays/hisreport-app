import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canViewReport, getReport, getVersion, viewableVersion } from "@/lib/reports";
import { one } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ReportRunner } from "@/components/report/report-runner";
import { FavoriteButton } from "@/components/report/favorite-button";
import { ReportSqlPanel } from "@/components/report/report-sql-panel";
import { Badge } from "@/components/ui/badge";
import type { ParamValues } from "@/lib/report-types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const r = await getReport(Number((await params).id)).catch(() => null);
  return { title: r?.name ?? "รายงาน" };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const report = await getReport(Number((await params).id));
  if (!report) notFound();

  if (!canViewReport(user, report)) {
    await audit({ userId: user.id, action: "denied", reportId: report.id });
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <ShieldAlert className="mx-auto mb-3 size-10 text-destructive" />
        <h1 className="text-xl font-semibold">ไม่มีสิทธิ์เข้าถึงรายงานนี้</h1>
        <p className="mt-2 text-muted-foreground">การเข้าถึงนี้ถูกบันทึกไว้ — ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์</p>
      </div>
    );
  }

  // ผู้ดูแลเปิดรายงานที่ยังไม่เผยแพร่ได้ (ดูเวอร์ชันล่าสุด)
  const useLatest = !report.published_version && user.isAdmin;
  const version = await viewableVersion(report, useLatest);
  if (!version) notFound();

  // SQL ส่งไปเบราว์เซอร์เฉพาะผู้ดูแลระบบ (ผู้ใช้ทั่วไปไม่เห็นโครงสร้างคิวรี่)
  const latest = user.isAdmin ? (report.latest_version === version.version ? version : await getVersion(report.id, report.latest_version)) : null;
  const recent = await one<{ params_json: unknown }>("SELECT params_json FROM user_recent WHERE user_id=? AND report_id=?", [user.id, report.id]);
  const fav = await one("SELECT 1 FROM user_favorite WHERE user_id=? AND report_id=?", [user.id, report.id]);
  const savedCount = await one<{ n: number }>("SELECT COUNT(*) AS n FROM saved_result WHERE user_id=? AND report_id=?", [user.id, report.id]);
  const saved = recent?.params_json ? (typeof recent.params_json === "string" ? JSON.parse(recent.params_json) : recent.params_json) as ParamValues : null;

  return (
    <div className="space-y-4">
      <div>
        {report.group_id && <Link href={`/groups/${report.group_id}`} className="text-sm text-muted-foreground hover:underline">{report.group_name}</Link>}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold sm:text-2xl">{report.name}</h1>
          <FavoriteButton reportId={report.id} initial={!!fav} />
          {report.status !== "published" && <Badge variant="outline">ยังไม่เผยแพร่ (v{version.version})</Badge>}
          {!!report.has_person_data && <Badge variant="outline" className="border-destructive/40 text-destructive">ข้อมูลส่วนบุคคล</Badge>}
        </div>
        {report.description && <p className="mt-1 max-w-4xl text-sm text-muted-foreground"><b>นิยาม:</b> {report.description}</p>}
      </div>
      {user.isAdmin && latest && (
        <ReportSqlPanel key={`${version.version}-${latest.version}-${latest.created_at}`} reportId={report.id} publishedVersion={report.published_version}
          viewed={{ version: version.version, sql: version.sql }} latest={{ version: latest.version, sql: latest.sql }} />
      )}
      <ReportRunner
        reportId={report.id}
        reportName={report.name}
        savedCount={Number(savedCount?.n ?? 0)}
        params={version.params}
        columns={version.columns}
        display={version.display}
        canExport={user.canExport}
        initialValues={saved}
        latest={useLatest}
      />
    </div>
  );
}
