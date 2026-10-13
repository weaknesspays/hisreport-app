"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/config";

export function FavoriteButton({ reportId, initial }: { reportId: number; initial: boolean }) {
  const [on, setOn] = useState(initial);
  async function toggle() {
    setOn(!on);
    const res = await fetch(api(`/favorites/${reportId}`), { method: on ? "DELETE" : "PUT" }).catch(() => null);
    if (!res?.ok) setOn(on);
  }
  return (
    <Button variant="ghost" size="sm" onClick={toggle} aria-pressed={on}>
      <Star className={on ? "fill-warning text-warning" : ""} /> {on ? "รายงานโปรด" : "เพิ่มรายงานโปรด"}
    </Button>
  );
}
