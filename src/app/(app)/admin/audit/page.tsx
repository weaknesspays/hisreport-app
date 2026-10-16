import { requireAdmin } from "@/lib/auth";
import { rows } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { LinkPager, LinkSortHead } from "@/components/ui/data-table-links";
import { thaiDate } from "@/lib/dates";
import { fmtNumber } from "@/lib/format";

export const metadata = { title: "ประวัติการใช้งาน" };

/** คอลัมน์ที่เรียงได้ → นิพจน์ SQL (whitelist — ค่าจาก URL ไม่ถูกต่อเข้า SQL ตรง ๆ) */
const SORTS: Record<string, string> = {
  time: "a.id", user: "u.username", action: "a.action", report: "COALESCE(r.name, a.detail)",
  params: "CAST(a.params_json AS CHAR)", rows: "a.row_count", sec: "a.duration_ms", ip: "a.ip",
};
const PAGE_SIZE = 50;

const ACTIONS: Record<string, { label: string; cls?: string }> = {
  login: { label: "เข้าสู่ระบบ" },
  login_fail: { label: "เข้าสู่ระบบไม่สำเร็จ", cls: "border-destructive/40 text-destructive" },
  logout: { label: "ออกจากระบบ" },
  view: { label: "เปิดรายงาน" },
  view_person: { label: "เปิดข้อมูลบุคคล", cls: "border-warning/50 text-warning" },
  export: { label: "Export", cls: "border-success/40 text-success" },
  edit_report: { label: "แก้ไขรายงาน" },
  publish_report: { label: "เผยแพร่รายงาน" },
  import_legacy: { label: "นำเข้าคิวรี่เดิม" },
  edit_permission: { label: "แก้ไขสิทธิ์", cls: "border-warning/50 text-warning" },
  edit_user: { label: "แก้ไขผู้ใช้", cls: "border-warning/50 text-warning" },
  edit_group: { label: "แก้ไขหัวข้อ" },
  edit_setting: { label: "แก้ไขค่าตั้งระบบ", cls: "border-warning/50 text-warning" },
  save_result: { label: "บันทึกแฟ้มผล" },
  view_saved: { label: "เปิดแฟ้มที่บันทึก" },
  export_saved: { label: "Export แฟ้มที่บันทึก", cls: "border-success/40 text-success" },
  delete_saved: { label: "ลบแฟ้มที่บันทึก" },
  denied: { label: "ถูกปฏิเสธสิทธิ์", cls: "border-destructive/40 text-destructive" },
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ user?: string; action?: string; date?: string; page?: string; sort?: string; dir?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const where: string[] = [];
  const args: unknown[] = [];
  if (sp.user) { where.push("u.username = ?"); args.push(sp.user); }
  if (sp.action) { where.push("a.action = ?"); args.push(sp.action); }
  if (sp.date) { where.push("a.created_at >= ? AND a.created_at < DATE_ADD(?, INTERVAL 1 DAY)"); args.push(sp.date, sp.date); }
  const sort = sp.sort && SORTS[sp.sort] ? sp.sort : null;
  const dir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";
  const orderBy = sort ? `${SORTS[sort]} ${dir.toUpperCase()}, a.id DESC` : "a.id DESC";
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const [{ n: total }] = await rows<{ n: number }>(
    `SELECT COUNT(*) AS n FROM audit_log a LEFT JOIN app_user u ON u.id = a.user_id ${whereSql}`, args);
  const pages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));
  const page = Math.min(Math.max(0, Math.floor(Number(sp.page) || 0)), pages - 1);
  // คงตัวกรองเดิมไว้ในทุกลิงก์
  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ user: sp.user, action: sp.action, date: sp.date, sort, dir: sort ? dir : null, page: String(page), ...patch })) if (v) q.set(k, v);
    if (q.get("page") === "0") q.delete("page");
    return `?${q}`;
  };
  const sortHref = (k: string | null, d: "asc" | "desc") => href({ sort: k, dir: k ? d : null, page: null });
  const H = (key: string, label: string, align?: "right") => <LinkSortHead label={label} sortKey={key} sort={sort} dir={dir} href={sortHref} align={align} />;
  const list = await rows<{ id: number; created_at: string; username: string | null; action: string; report_name: string | null; params_json: unknown; row_count: number | null; duration_ms: number | null; detail: string | null; ip: string | null }>(
    `SELECT a.id, a.created_at, u.username, a.action, r.name AS report_name, a.params_json, a.row_count, a.duration_ms, a.detail, a.ip
     FROM audit_log a LEFT JOIN app_user u ON u.id = a.user_id LEFT JOIN report r ON r.id = a.report_id
     ${whereSql} ORDER BY ${orderBy} LIMIT ${PAGE_SIZE} OFFSET ${page * PAGE_SIZE}`, args);
  const today = await rows<{ action: string; n: number }>("SELECT action, COUNT(*) AS n FROM audit_log WHERE created_at >= CURDATE() GROUP BY action");
  const n = (k: string) => Number(today.find((t) => t.action === k)?.n ?? 0);

  const params = (v: unknown) => {
    if (!v) return "";
    const o = typeof v === "string" ? JSON.parse(v) : v;
    return Object.entries(o as Record<string, unknown>).map(([k, x]) => `${k}=${typeof x === "object" && x && !Array.isArray(x) ? `${(x as { start: string }).start}..${(x as { end: string }).end}` : String(x)}`).join(", ");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold sm:text-2xl">ประวัติการใช้งาน</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["เปิดรายงานวันนี้", n("view") + n("view_person")], ["เปิดข้อมูลบุคคลวันนี้", n("view_person")], ["Export วันนี้", n("export")], ["ถูกปฏิเสธ / login ผิด", n("denied") + n("login_fail")]].map(([l, v]) => (
          <Card key={l as string} className="py-0"><CardContent className="p-4"><div className="text-sm text-muted-foreground">{l}</div><div className="text-2xl font-bold">{fmtNumber(v as number)}</div></CardContent></Card>
        ))}
      </div>
      <form className="flex flex-wrap gap-2">
        <input name="user" defaultValue={sp.user} placeholder="ชื่อผู้ใช้" className="h-9 w-40 rounded-md border bg-transparent px-3 text-sm" />
        <select name="action" defaultValue={sp.action ?? ""} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">ทุกการกระทำ</option>
          {Object.entries(ACTIONS).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}
        </select>
        <input type="date" name="date" defaultValue={sp.date} className="h-9 rounded-md border bg-transparent px-2 text-sm" />
        {sort && <><input type="hidden" name="sort" value={sort} /><input type="hidden" name="dir" value={dir} /></>}
        <Button type="submit" variant="outline" size="sm" className="h-9">กรอง</Button>
      </form>
      <Card className="gap-0 py-0"><div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>{H("time", "เวลา")}{H("user", "ผู้ใช้")}{H("action", "การกระทำ")}{H("report", "รายงาน / รายละเอียด")}{H("params", "เงื่อนไข")}{H("rows", "แถว", "right")}{H("sec", "วินาที", "right")}{H("ip", "IP")}</TableRow></TableHeader>
          <TableBody>
            {list.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="whitespace-nowrap text-sm">{thaiDate(a.created_at, true)}</TableCell>
                <TableCell>{a.username ?? "-"}</TableCell>
                <TableCell><Badge variant="outline" className={ACTIONS[a.action]?.cls}>{ACTIONS[a.action]?.label ?? a.action}</Badge></TableCell>
                <TableCell className="max-w-xs text-sm">{a.report_name ?? a.detail}</TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{params(a.params_json)}</TableCell>
                <TableCell className="text-right">{a.row_count ?? ""}</TableCell>
                <TableCell className="text-right">{a.duration_ms !== null ? (a.duration_ms / 1000).toFixed(1) : ""}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{a.ip}</TableCell>
              </TableRow>
            ))}
            {!list.length && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div></Card>
      <LinkPager page={page} pages={pages} total={Number(total)} pageSize={PAGE_SIZE} href={(p) => href({ page: String(p) })} />
    </div>
  );
}
