import { requireUser } from "@/lib/auth";
import { rows } from "@/lib/db";
import { RequestsView, type RequestRow } from "@/components/requests-view";

export const metadata = { title: "ขอรายงานใหม่" };

export default async function RequestsPage() {
  const user = await requireUser();
  const list = await rows<RequestRow>(
    `SELECT q.id, q.type, q.title, q.detail, q.urgency, q.status, q.contact, q.created_at, u.username, u.display_name, u.department
     FROM report_request q JOIN app_user u ON u.id = q.user_id
     ${user.isAdmin ? "" : "WHERE q.user_id = ?"} ORDER BY FIELD(q.status,'submitted','accepted','developing','verifying','published','rejected'), q.id DESC LIMIT 200`,
    user.isAdmin ? [] : [user.id]);
  return <RequestsView list={list} isAdmin={user.isAdmin} />;
}
