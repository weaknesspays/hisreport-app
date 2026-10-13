import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { allGroups, getReport, getVersion, listVersions } from "@/lib/reports";
import { ReportEditor, type EditorInitial } from "@/components/admin/report-editor";
import { DEFAULT_DISPLAY } from "@/lib/report-types";

export const metadata = { title: "แก้ไขรายงาน" };

const NEW_SQL = `SELECT
    d.icd10              AS icd10,
    i.icd10name          AS icd10name,
    COUNT(o.vn)          AS visit,
    COUNT(DISTINCT o.hn) AS person
FROM ovst o
INNER JOIN ovstdx d ON d.vn = o.vn
INNER JOIN icd101 i ON i.icd10 = d.icd10
WHERE o.vstdttm >= {date.start}
  AND o.vstdttm <  {date.end_next}
  AND o.an = '0'
  [[ AND d.icd10 BETWEEN {icd_from} AND {icd_to} ]]
GROUP BY d.icd10
ORDER BY visit DESC`;

export default async function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user.isAdmin && !user.canAuthor) redirect("/");
  const idParam = (await params).id;
  const groups = (await allGroups()).filter((g) => user.isAdmin || user.groupIds.includes(g.id));

  let initial: EditorInitial;
  if (idParam === "new") {
    initial = {
      id: null, status: "draft", publishedVersion: null, latestVersion: 1, versions: [],
      meta: { name: "", group_id: groups[0]?.id ?? null, code: "", description: "", reference: "", tags: "", type: "custom", has_person_data: false, cache_ttl: 1800, timeout_sec: 60, row_limit: 50000 },
      sql: NEW_SQL,
      params: [
        { name: "date", label: "ช่วงวันที่", type: "daterange", required: true, default: "fy_start,today" },
        { name: "icd_from", label: "ICD10 ตั้งแต่", type: "icd10" },
        { name: "icd_to", label: "ICD10 ถึง", type: "icd10" },
      ],
      columns: [],
      display: { ...DEFAULT_DISPLAY, views: ["table", "chart"] },
    };
  } else {
    const r = await getReport(Number(idParam));
    if (!r) notFound();
    if (!user.isAdmin && (r.group_id === null || !user.groupIds.includes(r.group_id))) redirect("/admin/reports");
    const v = await getVersion(r.id, r.latest_version);
    if (!v) notFound();
    initial = {
      id: r.id, status: r.status, publishedVersion: r.published_version, latestVersion: r.latest_version,
      versions: await listVersions(r.id),
      meta: {
        name: r.name, group_id: r.group_id, code: r.code ?? "", description: r.description ?? "", reference: r.reference ?? "", tags: r.tags ?? "",
        type: r.type, has_person_data: !!r.has_person_data, cache_ttl: r.cache_ttl, timeout_sec: r.timeout_sec, row_limit: r.row_limit,
      },
      sql: v.sql, params: v.params, columns: v.columns, display: v.display,
    };
  }

  return <ReportEditor initial={initial} groups={groups.map((g) => ({ id: g.id, name: g.name }))} isAdmin={user.isAdmin} />;
}
