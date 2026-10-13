import { requireUser } from "@/lib/auth";
import { listSaved, usage } from "@/lib/saved";
import { SavedManager } from "@/components/saved/saved-manager";

export const metadata = { title: "แฟ้มที่บันทึกไว้" };

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ report?: string }> }) {
  const user = await requireUser();
  const { report } = await searchParams;
  const items = await listSaved(user.id);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">แฟ้มที่บันทึกไว้</h1>
        <p className="text-sm text-muted-foreground">ผลรายงานที่คุณบันทึกไว้ เปิดดูได้ทันทีโดยไม่ต้องประมวลผลใหม่ — เห็นเฉพาะคุณ</p>
      </div>
      <SavedManager items={items} usage={await usage(user.id)} initialReport={Number(report) || null} />
    </div>
  );
}
