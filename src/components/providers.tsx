"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ColorProvider, ThemeSync } from "@/components/theme/color-provider";
import type { ThemeColor, ThemeMode } from "@/lib/config";

export function Providers({
  children, serverTheme, serverColor, loggedIn,
}: {
  children: React.ReactNode;
  serverTheme: ThemeMode | null;
  serverColor: ThemeColor | null;
  loggedIn: boolean;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme={serverTheme ?? "system"} enableSystem storageKey="hr-theme" disableTransitionOnChange>
      <ColorProvider serverColor={serverColor} loggedIn={loggedIn}>
        <ThemeSync serverTheme={serverTheme} loggedIn={loggedIn} />
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </ColorProvider>
    </ThemeProvider>
  );
}
