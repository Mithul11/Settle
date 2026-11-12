"use client";

import { CircleCheck, CloudOff, FilePlus2, Layers, RotateCcw, Search, SearchX, Upload } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { SetupHint } from "@/components/app/load-error";
import { DemoTag, PayLabel, Shimmer, Spinner, Timeline, WorkBadge } from "@/components/app/ui";
import { deriveDashboard, FILTERS, MATCH, type Filter, type Row } from "@/components/dashboard/data";
import { ActionGlyph } from "@/components/dashboard/glyphs";
import { PageTitle } from "@/components/shell/page-title";
import type { DashboardData } from "@/lib/queries";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fday, fdt, fmt, fmtK, shortRef, TONE, type PayStatus } from "@/lib/view";

const MilestoneGrid = dynamic(() => import("@/components/dashboard/milestone-grid").then((m) => m.MilestoneGrid), {
  ssr: false,
  loading: () => <div className="h-[300px]" />,
});

function useNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(max-width: 719px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(max-width: 719px)").matches,
    () => false,
  );
}

/** True from a role switch until the server sends data for the new role. */
function useRolePending(role: Role) {
  const [target, setTarget] = useState<Role | null>(null);
  useEffect(() => {
    const on = (e: Event) => setTarget((e as CustomEvent<Role>).detail);
    window.addEventListener("settle:role", on);
    return () => window.removeEventListener("settle:role", on);
  }, []);
  return target !== null && target !== role;
}

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 min-[1024px]:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-3.5 rounded-xl border border-line bg-surface p-[18px]">
            <Shimmer className="h-3 w-[55%]" />
            <Shimmer className="h-7 w-[70%] rounded-md" />
            <Shimmer className="h-2.5 w-[85%]" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Shimmer className="h-[300px] flex-[2_1_520px] rounded-xl" />
        <Shimmer className="h-[300px] flex-[1_1_300px] rounded-xl" />
      </div>
      <div className="rounded-xl border border-line bg-surface px-5 py-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex h-14 items-center gap-4 border-b border-line last:border-0">
            <Shimmer className="h-3 flex-[2]" />
            <Shimmer className="h-3 flex-1" />
            <Shimmer className="h-5 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-[34px] items-center gap-1.5 rounded-[7px] border px-2.5 text-[13px] font-medium whitespace-nowrap",
        active ? "border-line2 bg-surface2 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

const ACT_FILTERS = [
  ["all", "All", () => true],
  ["payments", "Payments", (t: string) => ["authorization", "capture", "void"].includes(t)],
  ["work", "Work & reviews", (t: string) => ["submission", "ai_review", "approval"].includes(t)],
  ["disputes", "Disputes", (t: string) => ["dispute", "settlement"].includes(t)],
] as const;

export function DashboardView({ data, role, error, setup }: { data: DashboardData | null; role: Role; error?: boolean; setup?: boolean }) {
  const router = useRouter();
  const isClient = role === "CLIENT";
  const narrow = useNarrow();
  const pending = useRolePending(role);
  const [retrying, startRetry] = useTransition();
  const [now] = useState(() => new Date());
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [payF, setPayF] = useState<"all" | PayStatus>("all");
  const [actF, setActF] = useState<(typeof ACT_FILTERS)[number][0]>("all");
  const d = useMemo(() => (data ? deriveDashboard(data, role, now) : null), [data, role, now]);

  const header = (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <PageTitle title="Dashboard" sub="Your milestones, payments and disputes" />
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
        <h1 className="m-0 text-[clamp(22px,2.6vw,28px)] font-semibold tracking-[-0.025em]">
          {greeting(now)}, {isClient ? "client" : "freelancer"}
        </h1>
        {d && (
          <span className="text-[13.5px] text-muted-foreground">
            {isClient ? "Client" : "Freelancer"} · {d.rows.length} milestone{d.rows.length === 1 ? "" : "s"} across {d.projects} project{d.projects === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {isClient ? (
        <Link href="/deals/new" className="btn-em text-on-em hover:text-on-em">
          <FilePlus2 className="size-4" />
          New deal
        </Link>
      ) : (
        <button
          type="button"
          className="btn-em"
          onClick={() => {
            const r = d?.rows.find((x) => x.status === "FUNDED");
            router.push(r ? r.href : "/dashboard");
          }}
          disabled={!d?.rows.some((x) => x.status === "FUNDED")}
          title={d?.rows.some((x) => x.status === "FUNDED") ? undefined : "No funded milestone is waiting for work"}
        >
          <Upload className="size-4" />
          Submit work
        </button>
      )}
    </div>
  );

  if (error || !d) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-12 text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-red-soft text-red"><CloudOff className="size-5" /></span>
          <span className="text-[16px] font-semibold">Couldn’t load your dashboard</span>
          <span className="max-w-[420px] text-[13.5px] text-muted-foreground">The payment ledger didn’t respond. No authorizations or captures were changed.</span>
          {setup && <SetupHint />}
          <button type="button" onClick={() => startRetry(() => router.refresh())} disabled={retrying} className="btn-line mt-1">
            {retrying ? <Spinner /> : <RotateCcw className="size-4" />}
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (pending) return <div className="flex flex-col gap-5">{header}<Skeleton /></div>;

  if (!d.hasData) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-14 text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-em-soft text-em"><Layers className="size-5" /></span>
          <span className="text-[16px] font-semibold">No milestones yet</span>
          <span className="max-w-[420px] text-[13.5px] text-muted-foreground">Create a deal and the AI Scoper drafts milestones. Authorizations, captures and reviews will appear here.</span>
          <Link href="/deals/new" className="btn-em mt-1 text-on-em hover:text-on-em"><FilePlus2 className="size-4" />Create a deal</Link>
        </div>
      </div>
    );
  }

  const rows = d.rows.filter((r) => MATCH[filter](r) && (payF === "all" || r.pay === payF));
  const ql = q.trim().toLowerCase();
  const visible = ql ? rows.filter((r) => [r.project, r.client, r.freelancer, r.milestone].join(" ").toLowerCase().includes(ql)) : rows;
  const actMatch = ACT_FILTERS.find((f) => f[0] === actF)![2];
  const evList = d.events.filter((e) => actMatch(e.type)).slice(0, 10);
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((p) => (p ? fmtK(d.top * p) : "$0"));

  return (
    <div className="flex flex-col gap-5">
      {header}
      <div className="flex animate-fade-up flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 min-[1024px]:grid-cols-4">
          {d.kpis.map((k) => (
            <div key={k.label} className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface px-[18px] pt-[18px] pb-4 transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-line2 hover:shadow-card">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-[13px] text-muted-foreground">{k.label}</span>
                <span className={cn("grid size-7 flex-none place-items-center rounded-lg", TONE[k.tone].fg, TONE[k.tone].bg)}>
                  <ActionGlyph name={k.icon} />
                </span>
              </div>
              <span className="text-[clamp(22px,2.4vw,30px)] leading-[1.1] font-semibold tracking-[-0.03em] tabular-nums">{k.value}</span>
              <span className="text-[12.5px] text-pretty text-muted-foreground">{k.sub}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-stretch gap-3">
          <section data-reveal="0" className="flex min-w-0 flex-[2_1_520px] flex-col gap-4 rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
              <div className="flex flex-[1_1_200px] flex-col gap-0.5">
                <span className="font-semibold">{isClient ? "Captured payments" : "Earnings"}</span>
                <span className="text-[12.5px] text-muted-foreground">{isClient ? "PayPal captures by month" : "Captured to your PayPal by month"} · {d.range}</span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums">{fmt(d.chartTotal)}</span>
                <span className="text-[12px] text-muted-foreground">6-month total</span>
              </div>
            </div>
            <div className="flex gap-4 text-[12px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-em" />Approved and captured</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-blue" />Captured via settlement</span>
            </div>
            <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-2">
              <div className="-mt-[7px] flex h-[200px] flex-col justify-between text-right font-mono text-[11px] text-muted-foreground">
                {ticks.map((t, i) => <span key={i}>{t}</span>)}
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <div className="relative h-[200px]">
                  <div className="absolute inset-0 flex flex-col justify-between">
                    {ticks.map((_, i) => <span key={i} className="h-0 border-t border-dashed border-line2" />)}
                  </div>
                  <div role="img" aria-label={`${isClient ? "Captured payments" : "Earnings"} by month`} className="absolute inset-0 grid grid-cols-6 items-end gap-1.5">
                    {d.months.map((m) => {
                      const total = m.full + m.set;
                      return (
                        <div key={m.key} title={`${m.label}: ${fmt(m.full)} approved, ${fmt(m.set)} via settlement`} className="flex h-full cursor-default flex-col items-center justify-end rounded-t-md px-[16%] hover:bg-chip">
                          <span className="pb-1 font-mono text-[11px] text-foreground">{total ? fmtK(total) : ""}</span>
                          <div className="flex w-full max-w-[44px] flex-col gap-0.5 overflow-hidden rounded-t-[5px] transition-[height] duration-600" style={{ height: `${(total / d.top) * 100}%` }}>
                            <span className="bg-blue" style={{ flex: m.set }} />
                            <span className="bg-em" style={{ flex: m.full }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {d.months.map((m) => <span key={m.key} className="text-center text-[12px] text-muted-foreground">{m.label}</span>)}
                </div>
              </div>
            </div>
          </section>
          <section data-reveal="1" className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold">Payment status</span>
              <span className="text-[12.5px] text-muted-foreground">{fmt(d.bdTotal)} across all your milestones</span>
            </div>
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-md bg-chip">
              {d.breakdown.map((b) => <span key={b.l} title={b.l} className={cn("transition-[width] duration-600", TONE[b.tone].dot)} style={{ width: `${b.w}%` }} />)}
            </div>
            <div className="flex flex-col">
              {d.breakdown.map((b) => (
                <div key={b.l} className="flex items-center gap-2.5 border-b border-line py-2.5 text-[13px]">
                  <span className={cn("size-2 flex-none rounded-sm", TONE[b.tone].dot)} />
                  <span className="min-w-0 flex-1">{b.l}</span>
                  <span className="font-mono text-[12px] text-muted-foreground">{Math.round(b.w)}%</span>
                  <span className="min-w-[72px] text-right font-mono text-[13px]">{fmt(b.v)}</span>
                </div>
              ))}
            </div>
            <span className="text-[12px] text-pretty text-muted-foreground">Authorized funds stay on the client’s PayPal account until captured. Voided amounts are never charged.</span>
          </section>
        </div>

        <div className="flex flex-wrap items-stretch gap-3">
          <section data-reveal="0" className="flex min-w-0 flex-[1_1_380px] flex-col rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-4 font-semibold">{isClient ? "Milestones awaiting your action" : "Milestones awaiting submission"}</div>
            {d.awaiting.map((a) => (
              <div key={a.id} className="flex items-center gap-3 border-b border-line px-5 py-3">
                <div className="flex min-w-0 flex-1 flex-col leading-[1.35]">
                  <span className="flex items-center gap-2 truncate font-medium">{a.milestone}{a.isDemo && <DemoTag />}</span>
                  <span className="truncate text-[12px] text-muted-foreground">{a.project} · {a.action!.why}</span>
                </div>
                <span className="font-mono text-[13px]">{fmt(a.amount)}</span>
                <Link href={a.href} className="flex h-9 min-w-11 items-center gap-1.5 rounded-lg border border-line2 bg-background px-3 text-[13px] font-medium whitespace-nowrap text-foreground hover:border-em hover:text-em">
                  <ActionGlyph name={a.action!.icon} />
                  {a.action!.label}
                </Link>
              </div>
            ))}
            {d.awaiting.length === 0 && (
              <div className="flex flex-col items-center gap-1.5 px-5 py-8 text-center text-[13px] text-muted-foreground">
                <CircleCheck className="size-5 text-em" />
                Nothing needs your action right now.
              </div>
            )}
          </section>
          <section data-reveal="1" className="flex min-w-0 flex-[1_1_380px] flex-col rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-4 font-semibold">{isClient ? "Recent payments" : "Recent earnings"}</div>
            {d.payments.map((p) => {
              const tone = p.type === "Capture" ? "em" : p.type === "Void" ? "muted" : "blue";
              return (
                <Link key={p.id} href={p.href} className="flex items-center gap-3 border-b border-line px-5 py-3 text-foreground hover:bg-chip hover:text-foreground">
                  <span className={cn("grid size-8 flex-none place-items-center rounded-lg", TONE[tone].fg, TONE[tone].bg)}>
                    <ActionGlyph name={p.type === "Capture" ? "banknote" : p.type === "Void" ? "view" : "wallet"} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col leading-[1.35]">
                    <span className="truncate font-medium">{p.type} · {p.milestone}</span>
                    <span className="truncate text-[12px] text-muted-foreground">
                      {p.party}{p.ref ? ` · PayPal ${shortRef(p.ref)}` : ""} · {fdt(p.at)}
                    </span>
                  </div>
                  <span className={cn("font-mono text-[13px] font-medium whitespace-nowrap", p.type === "Capture" ? "text-em" : p.type === "Void" ? "text-muted-foreground" : "")}>
                    {!isClient && p.type === "Capture" ? "+" : ""}{fmt(p.amount)}
                  </span>
                </Link>
              );
            })}
            {d.payments.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">No PayPal activity yet.</p>}
          </section>
        </div>

        <section data-reveal="0" className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-line px-5 py-4">
            <span className="font-semibold">Milestones</span>
            <span className="text-[12px] text-muted-foreground">{visible.length} of {d.rows.length}</span>
            <div className="ml-auto flex min-w-0 flex-[1_1_320px] flex-wrap justify-end gap-2">
              <label className="flex h-10 max-w-[280px] min-w-0 flex-[1_1_200px] items-center gap-2 rounded-lg border border-line2 bg-background px-2.5">
                <Search className="size-4 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects, people, milestones" aria-label="Search milestones" className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none" />
              </label>
              <select value={payF} onChange={(e) => setPayF(e.target.value as typeof payF)} aria-label="Filter by payment status" className="h-10 min-w-0 flex-[0_1_180px] rounded-lg border border-line2 bg-background px-2.5 text-[13px]">
                <option value="all">All payment statuses</option>
                <option value="unfunded">Not funded</option>
                <option value="authorized">Authorized</option>
                <option value="captured">Captured</option>
                <option value="partial">Partially captured</option>
                <option value="voided">Voided</option>
              </select>
            </div>
          </div>
          <div role="group" aria-label="Filter by status" className="flex gap-1 overflow-x-auto border-b border-line px-5 py-2.5">
            {FILTERS.map(([k, l]) => (
              <ChipButton key={k} active={filter === k} onClick={() => setFilter(k)}>
                {l}
                <span className="font-mono text-[11px] text-muted-foreground">{d.rows.filter(MATCH[k]).length}</span>
              </ChipButton>
            ))}
          </div>
          {visible.length > 0 && !narrow && <MilestoneGrid rows={rows} quickFilter={q} isClient={isClient} />}
          {visible.length > 0 && narrow && (
            <div className="flex flex-col">
              {visible.map((x) => <RowCard key={x.id} r={x} />)}
            </div>
          )}
          {visible.length === 0 && (
            <div className="flex flex-col items-center gap-2.5 px-5 py-12 text-center">
              <SearchX className="size-6 text-muted-foreground" />
              <span className="font-medium">No milestones match</span>
              <span className="text-[13px] text-muted-foreground">Try a different search, status or payment filter.</span>
              <button type="button" onClick={() => { setQ(""); setFilter("all"); setPayF("all"); }} className="btn-line h-10">Clear filters</button>
            </div>
          )}
        </section>

        <section data-reveal="1" className="flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-semibold">Activity</span>
            <div role="group" aria-label="Filter activity" className="ml-auto flex max-w-full gap-1 overflow-x-auto">
              {ACT_FILTERS.map(([k, l]) => <ChipButton key={k} active={actF === k} onClick={() => setActF(k)}>{l}</ChipButton>)}
            </div>
          </div>
          <Timeline items={evList} empty="No events of this type yet." />
        </section>
      </div>
    </div>
  );
}

function RowCard({ r }: { r: Row }) {
  const router = useRouter();
  return (
    <div onClick={() => router.push(r.href)} className="flex cursor-pointer flex-col gap-2.5 border-b border-line px-5 py-4">
      <div className="flex items-start gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col leading-[1.35]">
          <span className="flex items-center gap-2 font-medium">{r.milestone}{r.isDemo && <DemoTag />}</span>
          <span className="text-[12.5px] text-muted-foreground">{r.project} · {r.party}</span>
        </div>
        <span className="font-mono text-[13px]">{fmt(r.amount)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <WorkBadge status={r.work} />
        <PayLabel status={r.pay} />
        <span className="text-muted-foreground">· {fday(r.updated)}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); router.push(r.href); }}
          className={cn("ml-auto flex h-11 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold", r.action ? "bg-em text-on-em" : "border border-line2 text-muted-foreground")}
        >
          <ActionGlyph name={r.action?.icon ?? "view"} />
          {r.action?.label ?? "View"}
        </button>
      </div>
    </div>
  );
}
