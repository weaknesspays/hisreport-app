import "server-only";
import { exec, one, rows } from "./db";
import type { CurrentUser } from "./auth";
import { canViewReport, getVersion, listReports } from "./reports";
import type { ColumnDef, DisplayDef, ParamDef, ViewType } from "./report-types";

export type WidgetData = {
  id: number; reportId: number; name: string; groupName: string | null; view: ViewType; width: "quarter" | "half" | "full"; sort: number;
  params: ParamDef[]; columns: ColumnDef[]; display: DisplayDef;
};

export async function ensureDashboard(u: CurrentUser) {
  const d = await one<{ id: number; name: string }>("SELECT id, name FROM user_dashboard WHERE user_id=? ORDER BY sort, id LIMIT 1", [u.id]);
  if (d) return d;
  const r = await exec("INSERT INTO user_dashboard (user_id, name) VALUES (?, 'Dashboard ของฉัน')", [u.id]);
  return { id: r.insertId, name: "Dashboard ของฉัน" };
}

export async function dashboardWidgets(u: CurrentUser, dashboardId: number): Promise<WidgetData[]> {
  const list = await rows<{ id: number; report_id: number; view: string; width: string; sort: number }>(
    "SELECT id, report_id, view, width, sort FROM dashboard_widget WHERE dashboard_id=? ORDER BY sort, id", [dashboardId]);
  const out: WidgetData[] = [];
  const reports = list.length ? await listReports({ publishedOnly: true }) : [];
  for (const w of list) {
    const r = reports.find((x) => x.id === w.report_id);
    if (!r || !canViewReport(u, r) || !r.published_version) continue;
    const v = await getVersion(r.id, r.published_version);
    if (!v) continue;
    const views = v.display.views?.length ? v.display.views : ["table" as ViewType];
    const view = (views.includes(w.view as ViewType) ? w.view : views.includes("chart") ? "chart" : views[0]) as ViewType;
    out.push({
      id: w.id, reportId: r.id, name: r.name, groupName: r.group_name, view,
      width: (["quarter", "half", "full"].includes(w.width) ? w.width : "half") as WidgetData["width"], sort: w.sort,
      params: v.params, columns: v.columns, display: v.display,
    });
  }
  return out;
}

/** รายงานที่เลือกใส่ dashboard ได้ */
export async function pickableReports(u: CurrentUser) {
  const list = await listReports({ publishedOnly: true, groupIds: u.isAdmin ? undefined : u.groupIds });
  const out: { id: number; name: string; groupName: string | null; views: ViewType[] }[] = [];
  for (const r of list) {
    if (!r.published_version) continue;
    const v = await getVersion(r.id, r.published_version);
    if (!v || v.display.dashboard === false) continue;
    out.push({ id: r.id, name: r.name, groupName: r.group_name, views: v.display.views?.length ? v.display.views : ["table"] });
  }
  return out;
}
