"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/config";
import { thaiDate } from "@/lib/dates";

type Role = { id?: number; name: string; can_export: boolean; can_view_person: boolean; can_author: boolean; is_admin: boolean; groupIds: number[]; userCount?: number };
type User = { id?: number; username: string; display_name: string; department: string | null; auth_source: "his" | "local"; is_active: boolean; last_login?: string | null; roleIds: number[]; password?: string };

const FLAGS: { k: "can_export" | "can_view_person" | "can_author" | "is_admin"; label: string; hint: string }[] = [
  { k: "can_export", label: "Export", hint: "ส่งออก Excel / พิมพ์" },
  { k: "can_view_person", label: "ดูข้อมูลบุคคล", hint: "เห็นชื่อ เลขบัตร เบอร์โทร เต็ม" },
  { k: "can_author", label: "สร้างรายงาน", hint: "สร้าง/แก้ไขรายงานในหัวข้อที่เข้าถึงได้" },
  { k: "is_admin", label: "ผู้ดูแลระบบ", hint: "ทุกอย่าง" },
];

type HisUser = { username: string; displayName: string; suspended: boolean };

/** ค้นหาบุคลากรจากตาราง dct ของ HIS แล้วเติมชื่อผู้ใช้ให้ */
function HisUserSearch({ onPick }: { onPick: (u: HisUser) => void }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<HisUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function search() {
    if (q.trim().length < 2) return;
    setBusy(true); setErr(null);
    const res = await fetch(api(`/admin/his-users?q=${encodeURIComponent(q.trim())}`)).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setErr(d?.error || "ค้นหาไม่สำเร็จ"); setList([]); return; }
    setList(d.users);
    if (!d.users.length) setErr("ไม่พบ");
  }

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label>ค้นหาจากบุคลากรใน HIS</Label>
      <div className="flex gap-2">
        <Input value={q} placeholder="รหัส / ชื่อ / นามสกุล (อย่างน้อย 2 ตัวอักษร)" onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }} />
        <Button type="button" variant="outline" onClick={search} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : "ค้นหา"}</Button>
      </div>
      {err && <p className="text-xs text-muted-foreground">{err}</p>}
      {list.length > 0 && (
        <div className="max-h-48 divide-y overflow-y-auto rounded-md border">
          {list.map((u) => (
            <button key={u.username} type="button" disabled={u.suspended} onClick={() => { onPick(u); setList([]); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50">
              <span className="font-mono">{u.username}</span>
              <span className="truncate">{u.displayName}</span>
              {u.suspended && <Badge variant="outline" className="ml-auto">ถูกระงับใน HIS</Badge>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function UsersManager({ meId, groups, roles: initRoles, users }: { meId: number; groups: { id: number; name: string; category: string | null }[]; roles: Role[]; users: User[] }) {
  const router = useRouter();
  const [roles, setRoles] = useState(initRoles);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<User | null>(null);
  const [q, setQ] = useState("");

  const setRole = (i: number, patch: Partial<Role>) => setRoles(roles.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function saveRoles() {
    setSaving(true);
    const res = await fetch(api("/admin/roles"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roles }) }).catch(() => null);
    setSaving(false);
    if (!res?.ok) { toast.error((await res?.json().catch(() => null))?.error || "บันทึกไม่สำเร็จ"); return; }
    toast.success("บันทึกสิทธิ์แล้ว");
    router.refresh();
  }

  async function deleteRole(r: Role) {
    if (!r.id) { setRoles(roles.filter((x) => x !== r)); return; }
    const res = await fetch(api(`/admin/roles?id=${r.id}`), { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { toast.error((await res?.json().catch(() => null))?.error || "ลบไม่สำเร็จ"); return; }
    setRoles(roles.filter((x) => x !== r));
    toast.success("ลบ Role แล้ว");
  }

  async function saveUser() {
    if (!edit) return;
    const body = { ...edit, password: edit.password || undefined };
    const res = await fetch(api("/admin/users"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (!res?.ok) { toast.error((await res?.json().catch(() => null))?.error || "บันทึกไม่สำเร็จ"); return; }
    toast.success("บันทึกผู้ใช้แล้ว");
    setEdit(null);
    router.refresh();
  }

  const roleName = (id: number) => roles.find((r) => r.id === id)?.name ?? `#${id}`;
  const shownUsers = users.filter((u) => !q || `${u.username} ${u.display_name} ${u.department ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold sm:text-2xl">ผู้ใช้และสิทธิ์</h1>
      <Tabs defaultValue="roles">
        <TabsList><TabsTrigger value="roles">กลุ่มสิทธิ์ (Role)</TabsTrigger><TabsTrigger value="users">ผู้ใช้ ({users.length})</TabsTrigger></TabsList>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">Role × หัวข้อรายงาน</CardTitle>
                <CardDescription>ติ๊กหัวข้อที่ Role เข้าถึงได้ · ผู้ใช้ 1 คนมีได้หลาย Role (สิทธิ์รวมกัน) · ผู้ดูแลระบบเห็นทุกหัวข้อ</CardDescription>
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setRoles([...roles, { name: "Role ใหม่", can_export: false, can_view_person: false, can_author: false, is_admin: false, groupIds: [] }])}><Plus /> เพิ่ม Role</Button>
                <Button size="sm" onClick={saveRoles} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />} บันทึกสิทธิ์</Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-44">Role</TableHead>
                    {groups.map((g) => <TableHead key={g.id} className="min-w-20 whitespace-normal text-center text-xs" title={g.category ?? ""}>{g.name}</TableHead>)}
                    {FLAGS.map((f) => <TableHead key={f.k} className="min-w-20 whitespace-normal text-center text-xs" title={f.hint}>{f.label}</TableHead>)}
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((r, i) => (
                    <TableRow key={r.id ?? `new${i}`}>
                      <TableCell>
                        <Input className="h-8" value={r.name} onChange={(e) => setRole(i, { name: e.target.value })} />
                        <div className="mt-1 text-xs text-muted-foreground">{r.userCount ?? 0} ผู้ใช้</div>
                      </TableCell>
                      {groups.map((g) => (
                        <TableCell key={g.id} className="text-center">
                          <Checkbox checked={r.is_admin || r.groupIds.includes(g.id)} disabled={r.is_admin}
                            onCheckedChange={(c) => setRole(i, { groupIds: c ? [...r.groupIds, g.id] : r.groupIds.filter((x) => x !== g.id) })} />
                        </TableCell>
                      ))}
                      {FLAGS.map((f) => (
                        <TableCell key={f.k} className="text-center"><Checkbox checked={r[f.k]} onCheckedChange={(c) => setRole(i, { [f.k]: !!c })} /></TableCell>
                      ))}
                      <TableCell><Button size="icon" variant="ghost" className="size-8 text-destructive" disabled={(r.userCount ?? 0) > 0} onClick={() => deleteRole(r)}><Trash2 className="size-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!groups.length && <p className="mt-3 text-sm text-muted-foreground">ยังไม่มีหัวข้อรายงาน — สร้างที่เมนู หัวข้อรายงาน หรือนำเข้าจาก rep_query_item</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="ค้นหาผู้ใช้" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-64" />
            <Button className="ml-auto" onClick={() => setEdit({ username: "", display_name: "", department: "", auth_source: "his", is_active: true, roleIds: [] })}><Plus /> เพิ่มผู้ใช้</Button>
          </div>
          <Card className="py-0"><div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>ชื่อผู้ใช้</TableHead><TableHead>ชื่อ</TableHead><TableHead>หน่วยงาน</TableHead><TableHead>Role</TableHead><TableHead>เข้าสู่ระบบ</TableHead><TableHead>ล่าสุด</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {shownUsers.map((u) => (
                  <TableRow key={u.id} className={u.is_active ? "" : "opacity-50"}>
                    <TableCell className="font-medium">{u.username}</TableCell>
                    <TableCell>{u.display_name}</TableCell>
                    <TableCell className="text-sm">{u.department}</TableCell>
                    <TableCell>{u.roleIds.length ? u.roleIds.map((r) => <Badge key={r} variant="secondary" className="mr-1">{roleName(r)}</Badge>) : <span className="text-xs text-muted-foreground">ยังไม่มี (ไม่เห็นรายงานใด)</span>}</TableCell>
                    <TableCell><Badge variant="outline">{u.auth_source === "his" ? "บัญชี HIS" : "บัญชีในระบบ"}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{u.last_login ? thaiDate(u.last_login, true) : "-"}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => setEdit({ ...u, password: "" })}><Pencil /> แก้ไข</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3 sm:grid-cols-2">
              {!edit.id && edit.auth_source === "his" && (
                <HisUserSearch onPick={(p) => setEdit({ ...edit, username: p.username, display_name: p.displayName })} />
              )}
              <div className="space-y-1.5"><Label>ชื่อผู้ใช้ (ตรงกับ HIS) *</Label><Input value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>ชื่อ-สกุล *</Label><Input value={edit.display_name} onChange={(e) => setEdit({ ...edit, display_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>หน่วยงาน</Label><Input value={edit.department ?? ""} onChange={(e) => setEdit({ ...edit, department: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>วิธีเข้าสู่ระบบ</Label>
                <Select value={edit.auth_source} onValueChange={(v) => setEdit({ ...edit, auth_source: v as "his" | "local" })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="his">บัญชี HIS</SelectItem><SelectItem value="local">บัญชีในระบบนี้</SelectItem></SelectContent>
                </Select>
              </div>
              {edit.auth_source === "local" && (
                <div className="space-y-1.5 sm:col-span-2"><Label>รหัสผ่าน {edit.id ? "(เว้นว่าง = ไม่เปลี่ยน)" : "*"}</Label><Input type="password" autoComplete="new-password" value={edit.password ?? ""} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Role</Label>
                <div className="flex flex-wrap gap-3">
                  {roles.filter((r) => r.id).map((r) => (
                    <label key={r.id} className="flex items-center gap-1.5 text-sm">
                      <Checkbox checked={edit.roleIds.includes(r.id!)} onCheckedChange={(c) => setEdit({ ...edit, roleIds: c ? [...edit.roleIds, r.id!] : edit.roleIds.filter((x) => x !== r.id) })} />
                      {r.name}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 sm:col-span-2"><Switch checked={edit.is_active} disabled={edit.id === meId} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} /> ใช้งาน</label>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>ยกเลิก</Button><Button onClick={saveUser}>บันทึก</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
