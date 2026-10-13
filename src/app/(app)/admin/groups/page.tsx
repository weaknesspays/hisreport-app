import { requireAdmin } from "@/lib/auth";
import { allGroups } from "@/lib/reports";
import { rows } from "@/lib/db";
import { GroupsManager } from "@/components/admin/groups-manager";

export const metadata = { title: "หัวข้อรายงาน" };

export default async function GroupsPage() {
  await requireAdmin();
  const groups = await allGroups();
  const access = await rows<{ group_id: number; name: string }>("SELECT rg.group_id, r.name FROM role_group rg JOIN role r ON r.id = rg.role_id");
  const cats = await rows<{ name: string }>("SELECT name FROM report_category ORDER BY sort, name");
  return (
    <GroupsManager
      groups={groups.map((g) => ({
        id: g.id, name: g.name, icon: g.icon, description: g.description, category: g.category, sort: g.sort, is_active: !!g.is_active,
        report_count: Number(g.report_count), roles: access.filter((a) => a.group_id === g.id).map((a) => a.name),
      }))}
      categories={cats.map((c) => c.name)}
    />
  );
}
