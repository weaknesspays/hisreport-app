import Link from "next/link";
import { FileBarChart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type ReportListItem = { id: number; name: string; description: string | null; group_name?: string | null; has_person_data?: number; extra?: string };

export function ReportList({ items, empty = "ไม่พบรายงาน", showGroup = false }: { items: ReportListItem[]; empty?: string; showGroup?: boolean }) {
  if (!items.length) return <p className="py-10 text-center text-muted-foreground">{empty}</p>;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((r) => (
        <Link key={r.id} href={`/reports/${r.id}`} className="group">
          <Card className="h-full py-0 transition-colors group-hover:border-primary">
            <CardContent className="flex gap-3 p-4">
              <FileBarChart className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <div className="font-medium leading-snug">{r.name}</div>
                {showGroup && r.group_name && <div className="text-xs text-muted-foreground">{r.group_name}</div>}
                {r.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>}
                <div className="mt-2 flex flex-wrap gap-1">
                  {!!r.has_person_data && <Badge variant="outline" className="border-destructive/40 text-destructive">ข้อมูลบุคคล</Badge>}
                  {r.extra && <span className="text-xs text-muted-foreground">{r.extra}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
