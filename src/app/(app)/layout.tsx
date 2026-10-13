import { requireUser } from "@/lib/auth";
import { groupsForUser } from "@/lib/reports";
import { AppShell } from "@/components/app-shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const groups = await groupsForUser(user);
  return (
    <AppShell
      groups={groups.map((g) => ({ id: g.id, name: g.name, icon: g.icon, category: g.category, report_count: Number(g.report_count) }))}
      user={{ username: user.username, displayName: user.displayName, roles: user.roles.map((r) => r.name), isAdmin: user.isAdmin, canAuthor: user.canAuthor }}
    >
      {children}
    </AppShell>
  );
}
