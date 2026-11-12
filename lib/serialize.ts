// Server-side serializers: Prisma rows -> the DTOs in lib/types.ts, so every
// route and page produces identical JSON. Money becomes a two-decimal string
// and dates become ISO strings.
import type {
  Deal,
  Event,
  Mediation,
  Milestone,
  Prisma,
  Review,
} from "@prisma/client";
import {
  isMilestoneStatus,
  type DealDetailDTO,
  type DealDTO,
  type EventDTO,
  type MediationDTO,
  type MediationStatus,
  type MilestoneDTO,
  type ReviewDTO,
  type ReviewKind,
  type ReviewVerdict,
} from "./types";

/** Prisma `include` for a deal with everything DealDetailDTO needs. */
export const DEAL_DETAIL_INCLUDE = {
  milestones: {
    orderBy: { position: "asc" },
    include: { reviews: true, mediations: true, events: true },
  },
} as const satisfies Prisma.DealInclude;

/** Prisma `include` for a deal with its milestones in order (DealDTO). */
export const DEAL_INCLUDE = {
  milestones: { orderBy: { position: "asc" } },
} as const satisfies Prisma.DealInclude;

type DealWithMilestones = Deal & { milestones: Milestone[] };
type DealWithDetail = Deal & {
  milestones: (Milestone & {
    reviews: Review[];
    mediations: Mediation[];
    events: Event[];
  })[];
};

/** "50.00" from a Prisma Decimal, number or numeric string. */
export function toMoney(
  value: { toFixed(digits: number): string } | number | string,
): string {
  if (typeof value === "string") return Number(value).toFixed(2);
  return value.toFixed(2);
}

function toVerdict(value: string | null): ReviewVerdict | null {
  return value === "PASS" || value === "FAIL" ? value : null;
}

export function toMilestoneDTO(m: Milestone, isDemo: boolean): MilestoneDTO {
  return {
    id: m.id,
    dealId: m.dealId,
    position: m.position,
    title: m.title,
    criteria: Array.isArray(m.criteria) ? m.criteria.map(String) : [],
    amount: toMoney(m.amount),
    status: isMilestoneStatus(m.status) ? m.status : "DRAFT",
    heldAmount: toMoney(m.heldAmount),
    releasedAmount: toMoney(m.releasedAmount),
    refundedAmount: toMoney(m.refundedAmount),
    deliverableUrl: m.deliverableUrl,
    deliverableNote: m.deliverableNote,
    reviewScore: m.reviewScore,
    reviewVerdict: toVerdict(m.reviewVerdict),
    isDemo,
    updatedAt: m.updatedAt.toISOString(),
  };
}

export function toReviewDTO(r: Review): ReviewDTO {
  const kind: ReviewKind = r.kind === "MEDIATION" ? "MEDIATION" : "REVIEW";
  return {
    id: r.id,
    milestoneId: r.milestoneId,
    kind,
    verdict: toVerdict(r.verdict),
    score: r.score,
    result: r.result as unknown as ReviewDTO["result"],
    deliverableUrl: r.deliverableUrl,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toMediationDTO(m: Mediation): MediationDTO {
  return {
    id: m.id,
    milestoneId: m.milestoneId,
    status: m.status as MediationStatus,
    proposedReleasePercent: m.proposedReleasePercent,
    rationale: m.rationale,
    createdAt: m.createdAt.toISOString(),
  };
}

export function toEventDTO(e: Event): EventDTO {
  return {
    id: e.id,
    milestoneId: e.milestoneId,
    type: e.type,
    payload: e.payload,
    createdAt: e.createdAt.toISOString(),
  };
}

export function toDealDTO(deal: DealWithMilestones): DealDTO {
  return {
    id: deal.id,
    title: deal.title,
    brief: deal.brief,
    clientName: deal.clientName,
    clientEmail: deal.clientEmail,
    freelancerName: deal.freelancerName,
    isDemo: deal.isDemo,
    createdAt: deal.createdAt.toISOString(),
    milestones: [...deal.milestones]
      .sort((a, b) => a.position - b.position)
      .map((m) => toMilestoneDTO(m, deal.isDemo)),
  };
}

const byCreated = (a: { createdAt: Date }, b: { createdAt: Date }) =>
  a.createdAt.getTime() - b.createdAt.getTime();

/** reviews oldest first, mediations newest first, events newest first. */
export function toDealDetailDTO(deal: DealWithDetail): DealDetailDTO {
  const milestones = deal.milestones;
  return {
    ...toDealDTO(deal),
    reviews: milestones
      .flatMap((m) => m.reviews)
      .sort(byCreated)
      .map(toReviewDTO),
    mediations: milestones
      .flatMap((m) => m.mediations)
      .sort((a, b) => byCreated(b, a))
      .map(toMediationDTO),
    events: milestones
      .flatMap((m) => m.events)
      .sort((a, b) => byCreated(b, a))
      .map(toEventDTO),
  };
}
