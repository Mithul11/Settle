export const MILESTONE_STATUS = {
  PENDING: "PENDING", // created, not funded yet
  FUNDED: "FUNDED", // PayPal authorization holds the money
  SUBMITTED: "SUBMITTED", // freelancer submitted a deliverable (AI review, next step)
  DISPUTED: "DISPUTED", // client disputed (AI mediation, next step)
  RELEASE_PENDING: "RELEASE_PENDING", // capture accepted by PayPal but not completed yet
  RELEASED: "RELEASED", // full capture completed
  PARTIALLY_RELEASED: "PARTIALLY_RELEASED", // partial final capture, remainder voided
  VOIDED: "VOIDED", // authorization voided, hold released to the client
} as const;

export type MilestoneStatus =
  (typeof MILESTONE_STATUS)[keyof typeof MILESTONE_STATUS];

/** Statuses in which the authorization can still be captured or voided. */
export const HELD_STATUSES: string[] = [
  MILESTONE_STATUS.FUNDED,
  MILESTONE_STATUS.SUBMITTED,
  MILESTONE_STATUS.DISPUTED,
];
