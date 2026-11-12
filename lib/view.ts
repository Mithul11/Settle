// Client-safe view helpers: maps milestone data from the API/DB onto the
// design's separate "work status" and "payment status" badges, formats money
// and turns audit-trail events into timeline entries. No server imports.
import type { EventDTO, MilestoneDTO, MilestoneStatus } from "./types";

export type Tone = "em" | "blue" | "amber" | "red" | "muted";

/** Tailwind classes per tone. */
export const TONE: Record<Tone, { fg: string; bg: string; dot: string; border: string }> = {
  em: { fg: "text-em", bg: "bg-em-soft", dot: "bg-em", border: "border-em" },
  blue: { fg: "text-blue", bg: "bg-blue-soft", dot: "bg-blue", border: "border-blue" },
  amber: { fg: "text-amber", bg: "bg-amber-soft", dot: "bg-amber", border: "border-amber" },
  red: { fg: "text-red", bg: "bg-red-soft", dot: "bg-red", border: "border-red" },
  muted: { fg: "text-muted-foreground", bg: "bg-chip", dot: "bg-muted-foreground", border: "border-line2" },
};

// --- Money ---------------------------------------------------------------
export function num(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** "$1,200" (whole dollars) or "$1,200.50" when there are cents. */
export function fmt(value: string | number | null | undefined): string {
  const n = num(value);
  const cents = Math.round(n * 100) % 100 !== 0;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/** "$2.4k" for chart labels. */
export function fmtK(value: number): string {
  if (value === 0) return "$0";
  if (value < 1000) return "$" + Math.round(value);
  return "$" + +(value / 1000).toFixed(1) + "k";
}

/** Shortens a PayPal id: "8XK2…91A". */
export function shortRef(id: string | null | undefined): string {
  if (!id) return "";
  return id.length > 9 ? `${id.slice(0, 4)}…${id.slice(-3)}` : id;
}

// --- Dates ---------------------------------------------------------------
/** "Nov 9 · 11:20 AM" */
export function fdt(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

/** "Nov 9" */
export function fday(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// --- Work and payment status ---------------------------------------------
export type WorkStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "ai_review"
  | "approved"
  | "disputed"
  | "settled"
  | "cancelled";

export const WORK: Record<WorkStatus, { label: string; tone: Tone }> = {
  not_started: { label: "Not started", tone: "muted" },
  in_progress: { label: "In progress", tone: "blue" },
  submitted: { label: "Submitted", tone: "blue" },
  ai_review: { label: "AI reviewed", tone: "blue" },
  approved: { label: "Approved", tone: "em" },
  disputed: { label: "Disputed", tone: "amber" },
  settled: { label: "Settled", tone: "em" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

const WORK_BY_STATUS: Record<MilestoneStatus, WorkStatus> = {
  DRAFT: "not_started",
  FUNDED: "in_progress",
  SUBMITTED: "submitted",
  REVIEWED: "ai_review",
  RELEASED: "approved",
  DISPUTED: "disputed",
  SETTLED: "settled",
  VOIDED: "cancelled",
};

export function workStatus(status: MilestoneStatus): WorkStatus {
  return WORK_BY_STATUS[status] ?? "not_started";
}

export type PayStatus = "unfunded" | "authorized" | "captured" | "partial" | "voided";

export const PAY: Record<PayStatus, { label: string; tone: Tone }> = {
  unfunded: { label: "Not funded", tone: "muted" },
  authorized: { label: "Authorized", tone: "blue" },
  captured: { label: "Captured", tone: "em" },
  partial: { label: "Partially captured", tone: "em" },
  voided: { label: "Voided", tone: "muted" },
};

type LedgerFields = Pick<MilestoneDTO, "heldAmount" | "releasedAmount" | "refundedAmount" | "amount">;

/** Payment status from the ledger amounts on the milestone. */
export function payStatus(m: LedgerFields): PayStatus {
  const held = num(m.heldAmount);
  const released = num(m.releasedAmount);
  const refunded = num(m.refundedAmount);
  if (held > 0) return "authorized";
  if (released > 0 && refunded > 0) return "partial";
  if (released > 0) return "captured";
  if (refunded > 0) return "voided";
  return "unfunded";
}

/** Deal-page badge and progress per milestone status. */
export const STAGE: Record<MilestoneStatus, { label: string; tone: Tone; progress: number }> = {
  DRAFT: { label: "Awaiting funding", tone: "muted", progress: 0 },
  FUNDED: { label: "Funded", tone: "blue", progress: 30 },
  SUBMITTED: { label: "Submitted", tone: "blue", progress: 60 },
  REVIEWED: { label: "In review", tone: "blue", progress: 75 },
  DISPUTED: { label: "Disputed", tone: "amber", progress: 75 },
  RELEASED: { label: "Released", tone: "em", progress: 100 },
  SETTLED: { label: "Settled", tone: "em", progress: 100 },
  VOIDED: { label: "Voided", tone: "muted", progress: 0 },
};

// --- Ledger --------------------------------------------------------------
/**
 * Ledger totals from milestone amounts. Every funded milestone is one
 * authorization of its amount; captures are releasedAmount and voids are
 * refundedAmount, so open authorized = Σauth − Σcapture − Σvoid = Σheld.
 */
export function ledgerTotals(milestones: LedgerFields[]) {
  let total = 0, auth = 0, captured = 0, voided = 0, held = 0, unfunded = 0;
  for (const m of milestones) {
    const amount = num(m.amount);
    total += amount;
    const funded = num(m.heldAmount) + num(m.releasedAmount) + num(m.refundedAmount) > 0;
    if (funded) auth += amount;
    else unfunded += amount;
    captured += num(m.releasedAmount);
    voided += num(m.refundedAmount);
    held += num(m.heldAmount);
  }
  return { total, auth, captured, voided, held, unfunded };
}

// --- Events --------------------------------------------------------------
export type TimelineType =
  | "authorization"
  | "capture"
  | "void"
  | "submission"
  | "ai_review"
  | "approval"
  | "dispute"
  | "settlement";

export const TIMELINE: Record<TimelineType, { label: string; tone: Tone }> = {
  authorization: { label: "PayPal authorization", tone: "blue" },
  capture: { label: "PayPal capture", tone: "em" },
  void: { label: "Authorization voided", tone: "muted" },
  ai_review: { label: "AI review", tone: "blue" },
  submission: { label: "Submission", tone: "muted" },
  approval: { label: "Approval", tone: "em" },
  dispute: { label: "Dispute", tone: "amber" },
  settlement: { label: "Settlement", tone: "em" },
};

const EVENT_TO_TIMELINE: Record<string, TimelineType> = {
  FUNDED: "authorization",
  RELEASED: "capture",
  VOIDED: "void",
  SUBMITTED: "submission",
  REVIEWED: "ai_review",
  APPROVED: "approval",
  DISPUTED: "dispute",
  MEDIATION_PROPOSED: "dispute",
  SETTLEMENT_ACCEPTED: "settlement",
  SETTLED: "settlement",
};

export type TimelineEntry = {
  id: string;
  type: TimelineType;
  at: string;
  title: string;
  meta: string;
  milestoneId: string | null;
};

export function payloadOf(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
}

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null;
}

/**
 * Event row -> timeline entry, or null for internal events (order created,
 * webhook received, failed attempts). Titles use only data in the event.
 */
export function toTimeline(
  e: EventDTO,
  milestoneTitle: (id: string | null) => string,
): TimelineEntry | null {
  const type = EVENT_TO_TIMELINE[e.type];
  if (!type) return null;
  const p = payloadOf(e.payload);
  const title = milestoneTitle(e.milestoneId);
  const amount = str(p.amount) ?? str(p.releasedAmount) ?? str(p.capturedAmount);
  const refunded = str(p.refundedAmount);
  const ref = str(p.captureId) ?? str(p.authorizationId);
  const parts: string[] = [];
  let head = "";
  switch (e.type) {
    case "FUNDED":
      head = amount ? `${fmt(amount)} authorized` : "Milestone funded";
      break;
    case "RELEASED":
      head = amount ? `${fmt(amount)} captured` : "Payment captured";
      break;
    case "VOIDED":
      head = refunded || amount ? `${fmt(refunded ?? amount)} voided, returned to client` : "Authorization voided";
      break;
    case "SUBMITTED":
      head = "Work submitted";
      if (str(p.deliverableUrl)) parts.push(String(p.deliverableUrl).replace(/^https?:\/\//, ""));
      break;
    case "REVIEWED":
      head = "AI review completed";
      if (str(p.score)) parts.push(`score ${p.score}`);
      if (str(p.verdict)) parts.push(String(p.verdict));
      break;
    case "APPROVED":
      head = "Client approved";
      break;
    case "DISPUTED":
      head = "Dispute opened";
      if (str(p.reason)) parts.push(String(p.reason));
      break;
    case "MEDIATION_PROPOSED":
      head = "Mediators proposed a settlement";
      if (str(p.proposedReleasePercent)) parts.push(`${p.proposedReleasePercent}% to freelancer`);
      break;
    case "SETTLEMENT_ACCEPTED":
      head = "Settlement accepted";
      if (str(p.role)) parts.push(`by ${String(p.role).toLowerCase()}`);
      break;
    case "SETTLED":
      head = "Settlement executed";
      if (amount) parts.push(`${fmt(amount)} captured`);
      if (refunded) parts.push(`${fmt(refunded)} voided`);
      break;
  }
  const meta = [title, ...parts, ref ? `PayPal ${shortRef(ref)}` : ""].filter(Boolean).join(" · ");
  return { id: e.id, type, at: e.createdAt, title: head, meta, milestoneId: e.milestoneId };
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** github.com/<owner>/<repo>, with or without scheme. */
export const GITHUB_REPO_RE = /^(https?:\/\/)?(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/i;

export async function postJSON<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: string }).error;
    throw new Error(msg ?? `Request failed (${res.status})`);
  }
  return data as T;
}
