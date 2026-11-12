// Shared types for every Settle route, page and component.
// This file must stay importable from client components: constants and
// types only, and nothing but `import type` from server-side modules.
import type { MediationOutput, ReviewOutput, ScoperOutput } from "./ai";

export type { MediationOutput, ReviewOutput, ScoperOutput };

// --- Role (no auth: a cookie selects the view) ---------------------------
export const ROLE_COOKIE = "settle_role";
/** One year, in seconds. */
export const ROLE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const ROLES = ["FREELANCER", "CLIENT"] as const;
export type Role = (typeof ROLES)[number];
export const DEFAULT_ROLE: Role = "CLIENT";

export function isRole(value: unknown): value is Role {
  return value === "FREELANCER" || value === "CLIENT";
}

/** Any unknown or missing value falls back to CLIENT. */
export function parseRole(value: unknown): Role {
  return isRole(value) ? value : DEFAULT_ROLE;
}

// --- Status values -------------------------------------------------------
export const MILESTONE_STATUSES = [
  "DRAFT",
  "FUNDED",
  "SUBMITTED",
  "REVIEWED",
  "RELEASED",
  "DISPUTED",
  "SETTLED",
  "VOIDED",
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export function isMilestoneStatus(value: unknown): value is MilestoneStatus {
  return (MILESTONE_STATUSES as readonly unknown[]).includes(value);
}

export const MEDIATION_STATUSES = [
  "OPEN",
  "ACCEPTED_BY_FREELANCER",
  "ACCEPTED_BY_CLIENT",
  "ACCEPTED_BY_BOTH",
  "SETTLED",
] as const;
export type MediationStatus = (typeof MEDIATION_STATUSES)[number];

export type ReviewKind = "REVIEW" | "MEDIATION";
export type ReviewVerdict = "PASS" | "FAIL";
export type MediatorSpeaker = "FREELANCER_MEDIATOR" | "CLIENT_MEDIATOR";

/** Review.result for a row of kind MEDIATION (one row per turn). */
export type MediationTurnResult = {
  round: number;
  speaker: MediatorSpeaker;
  message: string;
  /** Release percent this side argued for in the turn. */
  percent?: number;
  /** Short evidence reference. */
  ref?: string;
};

export const EVENT_TYPES = [
  "ORDER_CREATED",
  "FUNDED",
  "SUBMITTED",
  "REVIEWED",
  "APPROVED",
  "RELEASED",
  "VOIDED",
  "DISPUTED",
  "MEDIATION_PROPOSED",
  "SETTLEMENT_ACCEPTED",
  "SETTLED",
  "PAYMENT_FAILED",
  "WEBHOOK_RECEIVED",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Authorization status as reported by PayPal (not a milestone status). */
export type PayPalAuthorizationStatus =
  | "CREATED"
  | "CAPTURED"
  | "DENIED"
  | "PARTIALLY_CAPTURED"
  | "VOIDED"
  | "PENDING";

// --- DTOs ----------------------------------------------------------------
// Money is a string with two decimals ("50.00"). Dates are ISO strings.
export type MilestoneDTO = {
  id: string;
  dealId: string;
  position: number;
  title: string;
  criteria: string[];
  amount: string;
  status: MilestoneStatus;
  heldAmount: string;
  releasedAmount: string;
  refundedAmount: string;
  deliverableUrl: string | null;
  deliverableNote: string | null;
  reviewScore: number | null;
  reviewVerdict: ReviewVerdict | null;
  /** True for seeded demo rows: no PayPal authorization, payment routes 409. */
  isDemo: boolean;
  updatedAt: string;
};

export type ReviewDTO = {
  id: string;
  milestoneId: string;
  kind: ReviewKind;
  verdict: ReviewVerdict | null;
  score: number | null;
  /** ReviewOutput when kind is REVIEW, MediationTurnResult when MEDIATION. */
  result: ReviewOutput | MediationTurnResult;
  deliverableUrl: string | null;
  createdAt: string;
};

export function isReviewResult(
  result: ReviewDTO["result"],
): result is ReviewOutput {
  return Array.isArray((result as ReviewOutput).criteria);
}

export function isMediationTurn(
  result: ReviewDTO["result"],
): result is MediationTurnResult {
  return typeof (result as MediationTurnResult).speaker === "string";
}

export type MediationDTO = {
  id: string;
  milestoneId: string;
  status: MediationStatus;
  proposedReleasePercent: number | null;
  rationale: string | null;
  createdAt: string;
};

export type EventDTO = {
  id: string;
  milestoneId: string | null;
  type: string;
  payload: unknown;
  createdAt: string;
};

export type DealDTO = {
  id: string;
  title: string;
  brief: string;
  clientName: string;
  clientEmail: string | null;
  freelancerName: string;
  isDemo: boolean;
  createdAt: string;
  milestones: MilestoneDTO[];
};

/** reviews oldest first, mediations newest first, events newest first. */
export type DealDetailDTO = DealDTO & {
  reviews: ReviewDTO[];
  mediations: MediationDTO[];
  events: EventDTO[];
};

// --- Errors --------------------------------------------------------------
// 400 bad input, 404, 409 wrong status, 422 unusable deliverable or
// authorization not held, 502 PayPal/GitHub/Gemini failed, 503 missing config.
export type ErrorResponse = { error: string; details?: unknown };

// --- Money routes --------------------------------------------------------
export type CreateOrderRequest = { milestoneId: string };
export type CreateOrderResponse = { orderId: string };

export type AuthorizeResponse = { status: "FUNDED"; authorizationId: string };

export type ApproveResponse = {
  status: "RELEASED";
  captureId: string;
  releasedAmount: string;
};

export type VoidResponse = { status: "VOIDED"; refundedAmount: string };

export type AcceptSettlementRequest = { role: Role };
export type AcceptSettlementResponse = {
  mediationStatus: MediationStatus;
  milestoneStatus: MilestoneStatus;
  settled: boolean;
  releasedAmount?: string;
  refundedAmount?: string;
  captureId?: string;
  /** Set when both parties accepted but no money moved (settled is false). */
  pendingReason?: string;
};

export type WebhookResponse = { received: true };
export type HealthResponse = { ok: boolean; db: "up" | "down" };

// --- AI and data routes --------------------------------------------------
export type ScopedMilestone = {
  title: string;
  criteria: string[];
  amountUSD: number;
};

export type ScopeRequest = { title: string; brief: string };
export type ScopeResponse = ScoperOutput;

export type CreateDealRequest = {
  title: string;
  brief: string;
  clientName: string;
  clientEmail: string;
  freelancerName?: string;
  milestones: ScopedMilestone[];
};
export type CreateDealResponse = { id: string };

export type SubmitRequest = { deliverableUrl: string; note?: string };
export type SubmitResponse = {
  status: MilestoneStatus;
  review: ReviewDTO | null;
  /** Present when the review failed; status then stays SUBMITTED. */
  reviewError?: string;
};

export type ReviewResponse = { review: ReviewDTO; cached: boolean };

export type DisputeRequest = { reason?: string };
export type DisputeResponse = { status: "DISPUTED"; mediation: MediationDTO };

export type MediateResponse = { mediation: MediationDTO; turns: ReviewDTO[] };
