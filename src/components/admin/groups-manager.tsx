"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead, TablePager } from "@/components/ui/data-table";
import { useTable } from "@/lib/use-table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GROUP_ICONS, GroupIcon } from "@/components/app-shell/icons";
import { api } from "@/lib/config";
import { cn } from "@/lib/utils";

type G = { id?: number; name: string; icon: string; description: string | null; category: string | null; sort: number; is_active: boolean; report_count?: number; roles?: string[] };

export function GroupsManager({ groups, categories }: { groups: G[]; categories: string[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<G | null>(null);
  const t = useTable(groups, { pageSize: 25, getValue: (g, k) => (k === "roles" ? g.roles?.join(", ") : (g as Record<string, unknown>)[k]) });
  const H = (key: string, label: string, align?: "right") => <SortableHead label={label} sortKey={key} sort={t.sort} onSort={t.toggleSort} align={align} />;

  async function save() {
    if (!edit) return;
    const res = await fetch(api("/admin/groups"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) }).catch(() => null);
    if (!res?.ok) { toast.error("บันทึกไม่สำเร็จ"); return; }
    toast.success("บันทึกแล้ว");
    setEdit(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">หัวข้อรายงาน</h1>
          <p className="text-sm text-muted-foreground">2 ระดับ: หมวดหลัก → หัวข้อ · สิทธิ์เข้าถึงกำหนดที่เมนู ผู้ใช้และสิทธิ์</p>
        </div>
        <Button className="ml-auto" onClick={() => setEdit({ name: "", icon: "folder", description: "", category: categories[0] ?? "", sort: 0, is_active: true })}><Plus /> เพิ่มหัวข้อ</Button>
      </div>
      <Card className="gap-0 py-0"><div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>{H("category", "หมวดหลัก")}{H("name", "หัวข้อ")}{H("report_count", "รายงาน", "right")}{H("roles", "Role ที่เข้าถึง")}{H("sort", "ลำดับ")}<TableHead /></TableRow></TableHeader>
          <TableBody>
            {t.rows.map((g) => (
              <TableRow key={g.id} className={cn(!g.is_active && "opacity-50")}>
                <TableCell className="text-sm text-muted-foreground">{g.category ?? "-"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium"><GroupIcon name={g.icon} className="size-4 text-primary" /> {g.name}</div>
                  {g.description && <div className="text-xs text-muted-foreground">{g.description}</div>}
                </TableCell>
                <TableCell className="text-right">{g.report_count}</TableCell>
                <TableCell>{g.roles?.length ? g.roles.map((r) => <Badge key={r} variant="secondary" className="mr-1">{r}</Badge>) : <span className="text-xs text-muted-foreground">เฉพาะผู้ดูแลระบบ</span>}</TableCell>
                <TableCell>{g.sort}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setEdit({ ...g })}><Pencil /> แก้ไข</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TablePager {...t} unit="หัวข้อ" setPageSize={t.setPageSize} className="border-t px-4 py-3" />
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "แก้ไขหัวข้อรายงาน" : "เพิ่มหัวข้อรายงาน"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <div className="space-y-1.5"><Label>ชื่อหัวข้อ *</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>หมวดหลัก</Label>
                <Input list="cats" value={edit.category ?? ""} onChange={(e) => setEdit({ ...edit, category: e.target.value })} placeholder="พิมพ์ใหม่หรือเลือก" />
                <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="space-y-1.5"><Label>คำอธิบาย</Label><Input value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>ไอคอน</Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(GROUP_ICONS).map((k) => (
                    <button key={k} type="button" title={k} onClick={() => setEdit({ ...edit, icon: k })}
                      className={cn("grid size-9 place-items-center rounded-md border", edit.icon === k && "border-primary bg-primary/10 text-primary")}>
                      <GroupIcon name={k} className="size-4" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-end gap-4">
                <div className="space-y-1.5"><Label>ลำดับ</Label><Input type="number" className="w-24" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} /></div>
                <label className="flex items-center gap-2 pb-2"><Switch checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} /> ใช้งาน</label>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>ยกเลิก</Button><Button onClick={save} disabled={!edit?.name.trim()}>บันทึก</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
