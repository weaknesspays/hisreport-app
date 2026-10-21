"use client";

import { api, BASE_PATH } from "@/lib/config";

export function LogoutButton() {
  return (
    <button type="button" className="text-sm text-muted-foreground hover:text-foreground hover:underline"
      onClick={async () => { await fetch(api("/auth/logout"), { method: "POST" }).catch(() => {}); window.location.href = `${BASE_PATH}/login`; }}>
      ออกจากระบบ
    </button>
  );
}
