import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { getShellSummary, logLoadError, type ShellSummary } from "@/lib/queries";
import { getRole } from "@/lib/role";

const EMPTY: ShellSummary = { held: 0, captured: 0, dealCount: 0, latestDeal: null, events: [], titles: {} };

/** Shell for every app route: sidebar, top bar, role switcher. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const role = await getRole();
  // The shell must still render when the database is down; pages show the error.
  const summary = await getShellSummary().catch((error) => {
    logLoadError("shell summary", error);
    return EMPTY;
  });
  return (
    <AppShell
      role={role}
      held={summary.held}
      captured={summary.captured}
      latestDeal={summary.latestDeal}
      events={summary.events}
      titles={summary.titles}
    >
      {children}
    </AppShell>
  );
}
