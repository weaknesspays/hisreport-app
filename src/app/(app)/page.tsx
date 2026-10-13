import { requireUser } from "@/lib/auth";
import { dashboardWidgets, ensureDashboard, pickableReports } from "@/lib/dashboard";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default async function DashboardPage() {
  const user = await requireUser();
  const d = await ensureDashboard(user);
  const [widgets, pickable] = await Promise.all([dashboardWidgets(user, d.id), pickableReports(user)]);
  return <DashboardView name={d.name} widgets={widgets} pickable={pickable} canExport={user.canExport} />;
}
