// Dashboard derivations from real deal data. Everything is computed from
// milestone ledger amounts and audit events; nothing is hardcoded.
import type { DashboardData } from "@/lib/queries";
import type { MilestoneStatus, Role } from "@/lib/types";
import {
  fmt,
  ledgerTotals,
  num,
  payStatus,
  toTimeline,
  workStatus,
  type PayStatus,
  type TimelineEntry,
  type Tone,
  type WorkStatus,
} from "@/lib/view";

export type ActionIcon = "wallet" | "scan-search" | "scale" | "upload";

export type Row = {
  id: string;
  dealId: string;
  project: string;
  client: string;
  freelancer: string;
  party: string;
  milestone: string;
  amount: number;
  status: MilestoneStatus;
  work: WorkStatus;
  pay: PayStatus;
  captured: number;
  updated: string;
  isDemo: boolean;
  href: string;
  action: { label: string; icon: ActionIcon; why: string } | null;
};

export type Filter = "all" | "action" | "progress" | "disputed" | "done";

export const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["action", "Needs action"],
  ["progress", "In progress"],
  ["disputed", "Disputed"],
  ["done", "Completed"],
];

export const MATCH: Record<Filter, (r: Row) => boolean> = {
  all: () => true,
  action: (r) => !!r.action,
  progress: (r) => ["not_started", "in_progress", "submitted", "ai_review"].includes(r.work),
  disputed: (r) => r.work === "disputed",
  done: (r) => ["approved", "settled"].includes(r.work),
};

export type KpiIcon = "lock" | "banknote" | "clipboard-check" | "triangle-alert" | "shield-check" | "upload";
export type Kpi = { label: string; value: string; sub: string; icon: KpiIcon; tone: Tone };

function actionFor(status: MilestoneStatus, isClient: boolean): Row["action"] {
  if (isClient) {
    if (status === "DRAFT" || status === "VOIDED") return { label: "Fund", icon: "wallet", why: "Not funded yet" };
    if (status === "REVIEWED") return { label: "Review", icon: "scan-search", why: "AI review ready" };
    if (status === "DISPUTED") return { label: "Mediate", icon: "scale", why: "Dispute open" };
  } else {
    if (status === "FUNDED") return { label: "Submit", icon: "upload", why: "Authorized · in progress" };
    if (status === "DISPUTED") return { label: "Mediate", icon: "scale", why: "Dispute open" };
  }
  return null;
}

function hrefFor(dealId: string, id: string, status: MilestoneStatus) {
  if (status === "REVIEWED") return `/deals/${dealId}/review?m=${id}`;
  if (status === "DISPUTED") return `/deals/${dealId}/dispute?m=${id}`;
  return `/deals/${dealId}`;
}

export function deriveDashboard(data: DashboardData, role: Role, now: Date) {
  const isClient = role === "CLIENT";
  const rows: Row[] = [];
  const titles: Record<string, string> = {};
  const demoMilestones = new Set<string>();
  for (const d of data.deals) {
    for (const m of d.milestones) {
      titles[m.id] = m.title;
      if (d.isDemo) demoMilestones.add(m.id);
      rows.push({
        id: m.id,
        dealId: d.id,
        project: d.title,
        client: d.clientName,
        freelancer: d.freelancerName,
        party: isClient ? d.freelancerName : d.clientName,
        milestone: m.title,
        amount: num(m.amount),
        status: m.status,
        work: workStatus(m.status),
        pay: payStatus(m),
        captured: num(m.releasedAmount),
        updated: m.updatedAt,
        isDemo: d.isDemo,
        href: hrefFor(d.id, m.id, m.status),
        action: actionFor(m.status, isClient),
      });
    }
  }
  rows.sort((a, b) => (a.updated < b.updated ? 1 : -1));

  // KPIs, chart and payment breakdown count real (non-demo) money only.
  const live = data.deals.filter((d) => !d.isDemo).flatMap((d) => d.milestones);
  const t = ledgerTotals(live);
  const liveRows = rows.filter((r) => !r.isDemo);
  const sum = (rs: Row[]) => rs.reduce((a, r) => a + r.amount, 0);
  const pl = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const nAuth = liveRows.filter((r) => r.pay === "authorized").length;
  const nCap = liveRows.filter((r) => r.captured > 0).length;
  const pendingApprove = liveRows.filter((r) => r.status === "SUBMITTED" || r.status === "REVIEWED");
  const pendingSubmit = liveRows.filter((r) => r.status === "FUNDED");
  const disputes = liveRows.filter((r) => r.status === "DISPUTED");
  const disputeKpi: Omit<Kpi, "label"> = {
    value: String(disputes.length),
    sub: disputes.length ? `${fmt(sum(disputes))} authorized, under mediation` : "No open disputes",
    icon: "triangle-alert",
    tone: disputes.length ? "amber" : "muted",
  };
  const kpis: Kpi[] = isClient
    ? [
        { label: "Total authorized", value: fmt(t.held), sub: `Open PayPal authorizations on ${pl(nAuth, "milestone")}`, icon: "lock", tone: "blue" },
        { label: "Total captured", value: fmt(t.captured), sub: `Paid to freelancers across ${pl(nCap, "milestone")}`, icon: "banknote", tone: "em" },
        { label: "Pending approvals", value: String(pendingApprove.length), sub: `${fmt(sum(pendingApprove))} of submitted work to review`, icon: "clipboard-check", tone: "blue" },
        { label: "Active disputes", ...disputeKpi },
      ]
    : [
        { label: "Total secured", value: fmt(t.held), sub: "Authorized by clients, not yet captured", icon: "shield-check", tone: "blue" },
        { label: "Total released", value: fmt(t.captured), sub: `Captured to your PayPal across ${pl(nCap, "milestone")}`, icon: "banknote", tone: "em" },
        { label: "Pending submissions", value: String(pendingSubmit.length), sub: `${fmt(sum(pendingSubmit))} authorized and ready for your work`, icon: "upload", tone: "blue" },
        { label: "Disputed milestones", ...disputeKpi },
      ];

  // Captures by month (last 6 months), from capture events or the milestone's update time.
  const captureAt: Record<string, string> = {};
  for (const e of data.events) {
    if ((e.type === "RELEASED" || e.type === "SETTLED") && e.milestoneId && !captureAt[e.milestoneId]) captureAt[e.milestoneId] = e.createdAt;
  }
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short" }),
      year: d.getFullYear(),
      full: 0,
      set: 0,
    };
  });
  for (const r of liveRows) {
    if (r.captured <= 0) continue;
    const at = captureAt[r.id] ?? r.updated;
    const mo = months.find((x) => at.startsWith(x.key));
    if (!mo) continue;
    if (r.pay === "partial" || r.status === "SETTLED") mo.set += r.captured;
    else mo.full += r.captured;
  }
  const peak = Math.max(0, ...months.map((x) => x.full + x.set));
  const top = Math.max(1000, Math.ceil((peak * 1.15) / 1000) * 1000);
  const chartTotal = months.reduce((a, x) => a + x.full + x.set, 0);
  const range = `${months[0]!.label}–${months[5]!.label} ${months[5]!.year}`;

  const bdTotal = t.captured + t.held + t.voided + t.unfunded;
  const breakdown = (
    [
      ["Captured", t.captured, "em"],
      [isClient ? "Authorized, not captured" : "Secured, not captured", t.held, "blue"],
      [isClient ? "Voided, never charged" : "Voided in settlement", t.voided, "red"],
      ["Not funded yet", t.unfunded, "muted"],
    ] as const
  ).map(([l, v, tone]) => ({ l, v, tone: tone as Tone, w: bdTotal ? (v / bdTotal) * 100 : 0 }));

  const awaiting = rows.filter((r) => r.action).slice(0, 5);

  // Ledger events; PayPal references come from the milestone row.
  const LEDGER: Record<string, "Authorization" | "Capture" | "Void"> = { FUNDED: "Authorization", RELEASED: "Capture", SETTLED: "Capture", VOIDED: "Void" };
  const rowById = Object.fromEntries(rows.map((r) => [r.id, r]));
  const payments = data.events
    .filter((e) => LEDGER[e.type] && e.milestoneId && rowById[e.milestoneId] && !demoMilestones.has(e.milestoneId))
    .slice(0, 5)
    .map((e) => {
      const r = rowById[e.milestoneId!]!;
      const refs = data.refs[r.id];
      const p = (e.payload ?? {}) as Record<string, unknown>;
      const type = LEDGER[e.type]!;
      const pick = (...v: unknown[]) => num(v.find((x) => x !== undefined && x !== null) as string);
      const amount =
        type === "Capture" ? pick(p.releasedAmount, p.amount, r.captured) : type === "Void" ? pick(p.refundedAmount, p.amount, r.amount) : pick(p.amount, r.amount);
      const ref = (type === "Capture" ? refs?.captureId : refs?.authorizationId) ?? null;
      return { id: e.id, type, milestone: r.milestone, party: r.party, ref, at: e.createdAt, amount, href: r.href };
    });

  const events: TimelineEntry[] = data.events
    .map((e) => toTimeline(e, (id) => (id ? titles[id] ?? "" : "")))
    .filter((x) => x !== null);

  return {
    rows,
    kpis,
    months,
    top,
    chartTotal,
    range,
    breakdown,
    bdTotal,
    awaiting,
    payments,
    events,
    projects: new Set(rows.map((r) => r.project)).size,
    parties: new Set(rows.map((r) => r.party)).size,
    hasData: rows.length > 0,
  };
}
