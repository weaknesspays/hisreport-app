import { requireAdmin } from "@/lib/auth";
import { rows } from "@/lib/db";
import { allGroups } from "@/lib/reports";
import { UsersManager } from "@/components/admin/users-manager";

export const metadata = { title: "ผู้ใช้และสิทธิ์" };

export default async function UsersPage() {
  const me = await requireAdmin();
  const roles = await rows<{ id: number; name: string; can_export: number; can_view_person: number; can_author: number; is_admin: number }>("SELECT * FROM role ORDER BY is_admin DESC, id");
  const rg = await rows<{ role_id: number; group_id: number }>("SELECT role_id, group_id FROM role_group");
  const users = await rows<{ id: number; username: string; display_name: string; department: string | null; auth_source: "his" | "local"; is_active: number; last_login: string | null }>(
    "SELECT id, username, display_name, department, auth_source, is_active, last_login FROM app_user ORDER BY is_active DESC, username");
  const ur = await rows<{ user_id: number; role_id: number }>("SELECT user_id, role_id FROM user_role");
  const groups = await allGroups();

  return (
    <UsersManager
      meId={me.id}
      groups={groups.map((g) => ({ id: g.id, name: g.name, category: g.category }))}
      roles={roles.map((r) => ({
        id: r.id, name: r.name, can_export: !!r.can_export, can_view_person: !!r.can_view_person, can_author: !!r.can_author, is_admin: !!r.is_admin,
        groupIds: rg.filter((x) => x.role_id === r.id).map((x) => x.group_id),
        userCount: ur.filter((x) => x.role_id === r.id).length,
      }))}
      users={users.map((u) => ({ ...u, is_active: !!u.is_active, roleIds: ur.filter((x) => x.user_id === u.id).map((x) => x.role_id) }))}
    />
  );
}
