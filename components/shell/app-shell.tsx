"use client";

import {
  Bell,
  Briefcase,
  FilePlus2,
  House,
  LayoutDashboard,
  Menu,
  Scale,
  ScanSearch,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { RoleSwitcher } from "@/components/role-switcher";
import { TimelineTile } from "@/components/shell/icons";
import { PageTitleProvider, usePageTitle } from "@/components/shell/page-title";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Logo } from "@/components/shell/logo";
import type { EventDTO, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fdt, fmt, toTimeline } from "@/lib/view";

export type ShellProps = {
  role: Role;
  held: number;
  captured: number;
  latestDeal: { id: string; title: string } | null;
  events: EventDTO[];
  titles: Record<string, string>;
  children: ReactNode;
};

type NavItem = { href: string | null; label: string; icon: LucideIcon; active: boolean };

function useNav(latestDeal: ShellProps["latestDeal"]): NavItem[] {
  const path = usePathname() ?? "";
  const match = /^\/deals\/([^/]+)/.exec(path);
  const dealId = match && match[1] !== "new" ? match[1] : latestDeal?.id ?? null;
  const base = dealId ? `/deals/${dealId}` : null;
  return [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, active: path === "/dashboard" },
    { href: "/deals/new", label: "New deal", icon: FilePlus2, active: path === "/deals/new" },
    { href: base, label: "Deal", icon: Briefcase, active: !!base && path === base },
    { href: base && `${base}/review`, label: "AI review", icon: ScanSearch, active: path.endsWith("/review") },
    { href: base && `${base}/dispute`, label: "Mediation", icon: Scale, active: path.endsWith("/dispute") },
  ];
}

function NavLinks({ items, compact, onNavigate }: { items: NavItem[]; compact?: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ href, label, icon: Icon, active }) => {
        const cls = cn(
          "flex h-10 items-center gap-3 rounded-lg px-3 font-medium transition-colors",
          compact ? "" : "max-[767px]:h-12",
          active ? "bg-surface2 text-foreground" : "text-muted-foreground hover:bg-surface2",
          !href && "pointer-events-none opacity-40",
        );
        const inner = (
          <>
            <Icon className={cn("size-[18px] flex-none", active ? "text-em" : "text-faint")} />
            <span className={cn("whitespace-nowrap", compact && "hidden min-[1100px]:inline")}>{label}</span>
          </>
        );
        return href ? (
          <Link key={label} href={href} title={label} onClick={onNavigate} className={cls} aria-current={active ? "page" : undefined}>
            {inner}
          </Link>
        ) : (
          <span key={label} title={`${label}: create a deal first`} className={cls} aria-disabled="true">
            {inner}
          </span>
        );
      })}
    </nav>
  );
}

function Notifications({ events, titles }: { events: EventDTO[]; titles: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const items = events
    .map((e) => toTimeline(e, (id) => (id ? titles[id] ?? "" : "")))
    .filter((x) => x !== null)
    .slice(0, 4);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-lg text-muted-foreground hover:bg-chip hover:text-foreground"
      >
        <Bell className="size-[17px]" />
        {items.length > 0 && (
          <span className="absolute top-[9px] right-[10px] size-[7px] rounded-full border-2 border-background bg-em" />
        )}
      </button>
      {open && (
        <div className="absolute top-12 right-0 z-30 w-[min(340px,calc(100vw-24px))] animate-fade-up overflow-hidden rounded-xl border border-line2 bg-glass shadow-card backdrop-blur-[18px]">
          <div className="flex items-center border-b border-line px-4 py-3">
            <span className="font-semibold">Notifications</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="ml-auto grid size-8 place-items-center text-muted-foreground">
              <X className="size-4" />
            </button>
          </div>
          {items.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">No activity yet.</p>}
          {items.map((a) => (
            <div key={a.id} className="flex gap-3 border-b border-line px-4 py-3 last:border-0">
              <TimelineTile type={a.type} size={30} />
              <span className="flex min-w-0 flex-col leading-[1.35]">
                <span className="text-[13px] font-medium">{a.title}</span>
                <span className="truncate text-[12px] text-faint">
                  {a.meta ? `${a.meta} · ` : ""}
                  {fdt(a.at)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopBar({ role, onMenu, events, titles }: { role: Role; onMenu: () => void; events: EventDTO[]; titles: Record<string, string> }) {
  const { title, sub } = usePageTitle();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-glass backdrop-blur-[14px]">
      <div className="flex h-16 items-center gap-3 px-5">
        <button type="button" onClick={onMenu} aria-label="Open navigation" className="-ml-2 grid size-11 flex-none place-items-center rounded-lg md:hidden">
          <Menu className="size-5" />
        </button>
        <div className="flex min-w-0 flex-auto flex-col leading-[1.25]">
          <span className="truncate text-[15px] font-semibold">{title}</span>
          {sub && <span className="truncate text-[12.5px] text-muted-foreground max-[719px]:hidden">{sub}</span>}
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <span
            title="All payments run in the PayPal Sandbox. No real money moves."
            className="mr-1 hidden items-center gap-1.5 rounded-full border border-amber/40 bg-amber-soft px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap text-amber min-[900px]:flex"
          >
            <span className="size-1.5 rounded-full bg-amber" />
            PayPal Sandbox
          </span>
          <RoleSwitcher initialRole={role} />
          <ThemeToggle />
          <Notifications events={events} titles={titles} />
          <span className="ml-1 grid size-[34px] place-items-center rounded-full border border-line2 bg-surface2 text-[12px] font-semibold max-[719px]:hidden">
            {role === "CLIENT" ? "CL" : "FR"}
          </span>
        </div>
      </div>
    </header>
  );
}

function UserBlock({ role, compact }: { role: Role; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 p-1.5">
      <span className="grid size-[34px] flex-none place-items-center rounded-full border border-line2 bg-surface2 text-[12px] font-semibold">
        {role === "CLIENT" ? "CL" : "FR"}
      </span>
      <span className={cn("flex min-w-0 flex-col leading-[1.3]", compact && "hidden min-[1100px]:flex")}>
        <span className="font-medium">{role === "CLIENT" ? "Client" : "Freelancer"}</span>
        <span className="text-[12px] text-muted-foreground">Viewing as {role === "CLIENT" ? "client" : "freelancer"}</span>
      </span>
    </div>
  );
}

/** Sidebar (≥1100 full, 768–1099 rail, <768 drawer) + sticky top bar. */
export function AppShell(props: ShellProps) {
  const { role, held, captured, latestDeal, events, titles, children } = props;
  const nav = useNav(latestDeal);
  const [drawer, setDrawer] = useState(false);

  const total = held + captured;
  return (
    <PageTitleProvider>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[72px] flex-none flex-col gap-5 border-r border-line bg-surface px-3 py-4 md:flex min-[1100px]:w-[248px]">
          <Link href="/" className="flex h-9 items-center gap-2.5 px-2 text-foreground hover:text-foreground" aria-label="Settle home">
            <Logo size={26} />
            <span className="hidden text-[17px] font-semibold tracking-[-0.02em] min-[1100px]:inline">Settle</span>
          </Link>
          <NavLinks items={nav} compact />
          <div className="mt-auto flex flex-col gap-3">
            <div className="hidden flex-col gap-1.5 rounded-[10px] border border-line p-3.5 min-[1100px]:flex">
              <span className="text-[12px] text-muted-foreground">Authorized via PayPal</span>
              <span className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums">{fmt(held)}</span>
              <span className="flex h-1 overflow-hidden rounded-sm bg-line">
                <span className="bg-em" style={{ width: total ? `${(captured / total) * 100}%` : 0 }} />
              </span>
              <span className="text-[12px] text-faint">{fmt(captured)} captured across your deals</span>
            </div>
            <UserBlock role={role} compact />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar role={role} onMenu={() => setDrawer(true)} events={events} titles={titles} />
          <main className="mx-auto w-full max-w-[1280px] flex-1 animate-fade-up px-5 pt-6 pb-16">{children}</main>
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 bg-[oklch(0.1_0.02_262/0.55)] backdrop-blur-[4px] md:hidden" onClick={() => setDrawer(false)}>
          <div
            role="dialog"
            aria-label="Navigation"
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 left-0 flex w-[min(300px,86vw)] animate-fade-up flex-col gap-5 border-r border-line2 bg-surface px-3 py-4"
          >
            <div className="flex h-11 items-center gap-2.5 px-2">
              <Logo size={26} />
              <span className="text-[17px] font-semibold">Settle</span>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close navigation" className="ml-auto grid size-11 place-items-center text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>
            <NavLinks items={nav} onNavigate={() => setDrawer(false)} />
            <Link href="/" onClick={() => setDrawer(false)} className="flex h-12 items-center gap-3 rounded-lg px-3 font-medium text-muted-foreground">
              <House className="size-[18px]" />
              Back to site
            </Link>
            <div className="mt-auto">
              <UserBlock role={role} />
            </div>
          </div>
        </div>
      )}
    </PageTitleProvider>
  );
}
