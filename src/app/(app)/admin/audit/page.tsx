import { requireAdmin } from "@/lib/auth";
import { rows } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { thaiDate } from "@/lib/dates";
import { fmtNumber } from "@/lib/format";

export const metadata = { title: "ประวัติการใช้งาน" };

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
  save_result: { label: "บันทึกแฟ้มผล" },
  view_saved: { label: "เปิดแฟ้มที่บันทึก" },
  export_saved: { label: "Export แฟ้มที่บันทึก", cls: "border-success/40 text-success" },
  delete_saved: { label: "ลบแฟ้มที่บันทึก" },
  denied: { label: "ถูกปฏิเสธสิทธิ์", cls: "border-destructive/40 text-destructive" },
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ user?: string; action?: string; date?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const where: string[] = [];
  const args: unknown[] = [];
  if (sp.user) { where.push("u.username = ?"); args.push(sp.user); }
  if (sp.action) { where.push("a.action = ?"); args.push(sp.action); }
  if (sp.date) { where.push("a.created_at >= ? AND a.created_at < DATE_ADD(?, INTERVAL 1 DAY)"); args.push(sp.date, sp.date); }
  const page = Math.max(0, Number(sp.page || 0));
  const list = await rows<{ id: number; created_at: string; username: string | null; action: string; report_name: string | null; params_json: unknown; row_count: number | null; duration_ms: number | null; detail: string | null; ip: string | null }>(
    `SELECT a.id, a.created_at, u.username, a.action, r.name AS report_name, a.params_json, a.row_count, a.duration_ms, a.detail, a.ip
     FROM audit_log a LEFT JOIN app_user u ON u.id = a.user_id LEFT JOIN report r ON r.id = a.report_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY a.id DESC LIMIT 100 OFFSET ${page * 100}`, args);
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
        <Button type="submit" variant="outline" size="sm" className="h-9">กรอง</Button>
      </form>
      <Card className="py-0"><div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>เวลา</TableHead><TableHead>ผู้ใช้</TableHead><TableHead>การกระทำ</TableHead><TableHead>รายงาน / รายละเอียด</TableHead><TableHead>เงื่อนไข</TableHead><TableHead className="text-right">แถว</TableHead><TableHead className="text-right">วินาที</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
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
      <div className="flex justify-end gap-2">
        {page > 0 && <Button variant="outline" size="sm" asChild><a href={`?${new URLSearchParams({ ...sp, page: String(page - 1) })}`}>ก่อนหน้า</a></Button>}
        {list.length === 100 && <Button variant="outline" size="sm" asChild><a href={`?${new URLSearchParams({ ...sp, page: String(page + 1) })}`}>ถัดไป</a></Button>}
      </div>
    </div>
  );
}
