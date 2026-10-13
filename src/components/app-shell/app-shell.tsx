"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ClipboardList, FileCog, FolderOpen, History, LayoutDashboard, LogOut, Menu, Search, Settings, Shield, Star, Tags,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeMenu } from "@/components/theme/theme-menu";
import { GroupIcon } from "./icons";
import { APP_NAME, api } from "@/lib/config";
import { cn } from "@/lib/utils";

export type ShellGroup = { id: number; name: string; icon: string; category: string | null; report_count: number };
export type ShellUser = { username: string; displayName: string; roles: string[]; isAdmin: boolean; canAuthor: boolean };

function NavLink({ href, icon, children, count, onNavigate }: { href: string; icon: React.ReactNode; children: React.ReactNode; count?: number; onNavigate?: () => void }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[14.5px] transition-colors",
        active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <span className="[&>svg]:size-4 shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
      {count !== undefined && <span className={cn("ml-auto rounded-full px-[7px] text-xs", active ? "bg-white/20" : "bg-white/12")}>{count}</span>}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="px-2.5 pb-1.5 pt-4 text-xs font-semibold tracking-wide text-sidebar-muted">{title}</div>
      {children}
    </div>
  );
}

function SidebarBody({ groups, user, onNavigate }: { groups: ShellGroup[]; user: ShellUser; onNavigate?: () => void }) {
  const byCat = new Map<string, ShellGroup[]>();
  for (const g of groups) {
    const k = g.category ?? "หัวข้อรายงาน";
    byCat.set(k, [...(byCat.get(k) ?? []), g]);
  }
  return (
    <nav className="px-3 pb-6">
      <div className="space-y-0.5 pt-2">
        <NavLink href="/" icon={<LayoutDashboard />} onNavigate={onNavigate}>Dashboard</NavLink>
        <NavLink href="/favorites" icon={<Star />} onNavigate={onNavigate}>รายงานโปรด / ล่าสุด</NavLink>
        <NavLink href="/saved" icon={<FolderOpen />} onNavigate={onNavigate}>แฟ้มที่บันทึกไว้</NavLink>
      </div>
      {[...byCat.entries()].map(([cat, list]) => (
        <Section key={cat} title={cat}>
          {list.map((g) => (
            <NavLink key={g.id} href={`/groups/${g.id}`} icon={<GroupIcon name={g.icon} />} count={g.report_count} onNavigate={onNavigate}>{g.name}</NavLink>
          ))}
        </Section>
      ))}
      {!groups.length && <p className="px-2.5 pt-4 text-sm text-sidebar-muted">ยังไม่มีหัวข้อรายงานที่คุณเข้าถึงได้ — ติดต่อผู้ดูแลระบบ</p>}
      {(user.isAdmin || user.canAuthor) && (
        <Section title="ผู้ดูแลระบบ">
          <NavLink href="/admin/reports" icon={<FileCog />} onNavigate={onNavigate}>จัดการรายงาน</NavLink>
          {user.isAdmin && <>
            <NavLink href="/admin/groups" icon={<Tags />} onNavigate={onNavigate}>หัวข้อรายงาน</NavLink>
            <NavLink href="/admin/users" icon={<Shield />} onNavigate={onNavigate}>ผู้ใช้และสิทธิ์</NavLink>
            <NavLink href="/admin/audit" icon={<History />} onNavigate={onNavigate}>ประวัติการใช้งาน</NavLink>
          </>}
        </Section>
      )}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-5 pb-4 pt-5">
      <div className="grid size-[34px] place-items-center rounded-lg bg-logo text-[15px] font-bold text-white">HR</div>
      <span className="text-lg font-bold text-white">{APP_NAME}</span>
    </Link>
  );
}

const TITLES: [string, string][] = [
  ["/favorites", "รายงานโปรด / ล่าสุด"],
  ["/search", "ค้นหารายงาน"],
  ["/saved", "แฟ้มที่บันทึกไว้"],
  ["/requests", "ขอรายงานใหม่"],
  ["/settings", "ตั้งค่าการแสดงผล"],
  ["/reports/", "รายงาน"],
  ["/admin/reports", "จัดการรายงาน"],
  ["/admin/groups", "หัวข้อรายงาน"],
  ["/admin/users", "ผู้ใช้และสิทธิ์"],
  ["/admin/audit", "ประวัติการใช้งาน"],
];

function pageTitle(path: string, groups: ShellGroup[]) {
  if (path === "/") return "Dashboard";
  const g = path.match(/^\/groups\/(\d+)/);
  if (g) return groups.find((x) => x.id === Number(g[1]))?.name ?? "หัวข้อรายงาน";
  return TITLES.find(([p]) => path.startsWith(p))?.[1] ?? "";
}

export function AppShell({ groups, user, children }: { groups: ShellGroup[]; user: ShellUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const path = usePathname();

  async function logout() {
    await fetch(api("/auth/logout"), { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") || "").trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      {/* คอมพิวเตอร์: เมนูข้างถาวร */}
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <Brand />
        <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-thumb]]:bg-white/20"><SidebarBody groups={groups} user={user} /></ScrollArea>
      </aside>

      {/* แท็บเล็ต/มือถือ: เมนูแบบลิ้นชัก */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="sr-only"><SheetTitle>เมนู</SheetTitle></SheetHeader>
          <Brand />
          <ScrollArea className="h-[calc(100dvh-4.5rem)] [&_[data-slot=scroll-area-thumb]]:bg-white/20"><SidebarBody groups={groups} user={user} onNavigate={() => setOpen(false)} /></ScrollArea>
        </SheetContent>
      </Sheet>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card px-3 sm:px-[22px]">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="เปิดเมนู"><Menu /></Button>
          <div className="hidden max-w-64 truncate text-[17px] font-semibold md:block">{pageTitle(path, groups)}</div>
          <form onSubmit={onSearch} className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" placeholder="ค้นหารายงาน เช่น CKD, refer, ไข้เลือดออก" className="h-9 pl-8" />
          </form>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild aria-label="ขอรายงานใหม่"><Link href="/requests"><ClipboardList className="size-5" /></Link></Button>
            <ThemeMenu />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-11 gap-2 px-1.5 sm:px-2">
                  <Avatar className="size-8"><AvatarFallback className="bg-primary/12 text-sm font-bold text-primary">{user.displayName.slice(0, 1)}</AvatarFallback></Avatar>
                  <span className="hidden max-w-40 text-left leading-tight sm:block">
                    <span className="block truncate text-sm">{user.displayName}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">{user.isAdmin ? "ผู้ดูแลระบบ" : user.roles[0] ?? "ยังไม่มีสิทธิ์"}</span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="truncate">{user.displayName}</div>
                  <div className="truncate text-xs font-normal text-muted-foreground">{user.username} · {user.roles.join(", ") || "ยังไม่มีสิทธิ์"}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/settings"><Settings /> ตั้งค่าการแสดงผล</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={logout}><LogOut /> ออกจากระบบ</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="w-full max-w-[1400px] p-4 pb-10 sm:px-[22px] sm:pt-5">{children}</main>
      </div>
    </div>
  );
}
