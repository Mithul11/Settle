// Milestone status lifecycle (docs/settle-spec.md section 4). Pure data and
// helpers: safe to import from routes and from client components.
import type { MediationStatus, MilestoneStatus } from "./types";

export const MILESTONE_STATUS = {
  DRAFT: "DRAFT", // created, not funded yet
  FUNDED: "FUNDED", // a PayPal authorization holds the money
  SUBMITTED: "SUBMITTED", // freelancer submitted a deliverable
  REVIEWED: "REVIEWED", // AI review done, waiting for the client
  RELEASED: "RELEASED", // client approved, full capture
  DISPUTED: "DISPUTED", // client disputed, mediation in progress
  SETTLED: "SETTLED", // settlement accepted by both, split paid out
  VOIDED: "VOIDED", // authorization voided, hold returned to the client
} as const satisfies Record<MilestoneStatus, MilestoneStatus>;

export const MEDIATION_STATUS = {
  OPEN: "OPEN",
  ACCEPTED_BY_FREELANCER: "ACCEPTED_BY_FREELANCER",
  ACCEPTED_BY_CLIENT: "ACCEPTED_BY_CLIENT",
  ACCEPTED_BY_BOTH: "ACCEPTED_BY_BOTH", // both accepted, capture not run yet
  SETTLED: "SETTLED",
} as const satisfies Record<MediationStatus, MediationStatus>;

export type MilestoneAction =
  | "authorize"
  | "submit"
  | "review"
  | "approve"
  | "void"
  | "dispute"
  | "settle";

/** Statuses an action may start from. Anything else is a 409. */
export const ALLOWED_FROM: Record<MilestoneAction, readonly MilestoneStatus[]> = {
  authorize: ["DRAFT", "VOIDED"],
  submit: ["FUNDED", "REVIEWED"],
  review: ["SUBMITTED"],
  approve: ["REVIEWED"],
  void: ["FUNDED", "SUBMITTED", "REVIEWED"],
  dispute: ["REVIEWED"],
  settle: ["DISPUTED"],
};

/** Status an action ends in when it succeeds. */
export const RESULT_STATUS: Record<MilestoneAction, MilestoneStatus> = {
  authorize: "FUNDED",
  submit: "SUBMITTED",
  review: "REVIEWED",
  approve: "RELEASED",
  void: "VOIDED",
  dispute: "DISPUTED",
  settle: "SETTLED",
};

export function canTransition(status: string, action: MilestoneAction): boolean {
  return (ALLOWED_FROM[action] as readonly string[]).includes(status);
}

/** Money has left the hold. Webhooks must never move these backwards. */
export const FINAL_STATUSES: readonly MilestoneStatus[] = ["RELEASED", "SETTLED"];

export function isFinalStatus(status: string): boolean {
  return (FINAL_STATUSES as readonly string[]).includes(status);
}

/** Mediation statuses in which a party may still accept the proposal. */
export const MEDIATION_ACCEPTABLE: readonly MediationStatus[] = [
  "OPEN",
  "ACCEPTED_BY_FREELANCER",
  "ACCEPTED_BY_CLIENT",
];

/** 409 message for payment actions on rows without a PayPal authorization. */
export const NO_AUTHORIZATION_MESSAGE =
  "Demo milestone: no PayPal authorization";

/**
 * True when the milestone has a PayPal authorization that a payment route
 * may act on. Seeded demo rows never have one.
 */
export function hasAuthorization(milestone: {
  authorizationId: string | null;
}): milestone is { authorizationId: string } {
  return (
    typeof milestone.authorizationId === "string" &&
    milestone.authorizationId.length > 0
  );
}

/** Stable PayPal-Request-Id per operation, so a retry cannot capture twice. */
export const paypalRequestId = {
  authorize: (orderId: string) => `authorize-${orderId}`,
  approve: (milestoneId: string) => `approve-${milestoneId}`,
  void: (milestoneId: string) => `void-${milestoneId}`,
  settle: (mediationId: string) => `settle-${mediationId}`,
};

/** Settlement capture runs only when this env flag is exactly "true". */
export function isSettlementCaptureEnabled(): boolean {
  return process.env.SETTLEMENT_CAPTURE_ENABLED === "true";
}

export const STATUS_LABEL: Record<MilestoneStatus, string> = {
  DRAFT: "Draft",
  FUNDED: "Funded",
  SUBMITTED: "Submitted",
  REVIEWED: "Reviewed",
  RELEASED: "Released",
  DISPUTED: "Disputed",
  SETTLED: "Settled",
  VOIDED: "Voided",
};
