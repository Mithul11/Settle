import { NextResponse } from "next/server";
import type { ReviewOutput } from "@/lib/ai";
import { mediateDispute } from "@/lib/agents";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { errorResponse, jsonError } from "@/lib/http";
import { toMediationDTO, toReviewDTO } from "@/lib/serialize";
import { MILESTONE_STATUS } from "@/lib/status";
import type { MediateResponse, MediationTurnResult } from "@/lib/types";
import { payloadOf } from "@/lib/view";

// AI mediation only: proposes a split, moves no money (no lib/paypal import).
export const maxDuration = 90;

// POST /api/ai/mediate/:milestoneId -> { mediation, turns }
export async function POST(_request: Request, { params }: { params: Promise<{ milestoneId: string }> }) {
  const { milestoneId } = await params;
  try {
    const m = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    if (!m) return jsonError(404, "Milestone not found");
    if (m.status !== MILESTONE_STATUS.DISPUTED) {
      return jsonError(409, `Milestone is ${m.status}; only disputed milestones can be mediated`);
    }

    const mediation = await prisma.mediation.findFirst({ where: { milestoneId }, orderBy: { createdAt: "desc" } });
    if (!mediation) return jsonError(409, "This milestone has no open mediation");
    if (mediation.status === "SETTLED" || mediation.status === "ACCEPTED_BY_BOTH") {
      return jsonError(409, "Both parties already accepted this settlement");
    }

    const [review, disputed] = await Promise.all([
      prisma.review.findFirst({ where: { milestoneId, kind: "REVIEW" }, orderBy: { createdAt: "desc" } }),
      prisma.event.findFirst({ where: { milestoneId, type: "DISPUTED" }, orderBy: { createdAt: "desc" } }),
    ]);
    const reason = payloadOf(disputed?.payload).reason;

    const out = await mediateDispute({
      milestoneTitle: m.title,
      amount: (m.heldAmount.gt(0) ? m.heldAmount : m.amount).toFixed(2),
      criteria: Array.isArray(m.criteria) ? m.criteria.map(String) : [],
      reason: typeof reason === "string" ? reason : null,
      review: (review?.result as ReviewOutput | undefined) ?? null,
      note: m.deliverableNote,
    });
    const percent = Math.max(0, Math.min(100, Math.round(out.proposedReleasePercent)));

    // Each freelancer turn opens a new round.
    let round = 0;
    const turns: MediationTurnResult[] = out.turns.map((t) => {
      if (t.speaker === "FREELANCER_MEDIATOR" || round === 0) round++;
      return { round, speaker: t.speaker, message: t.message, percent: t.positionPercent, ref: t.evidence };
    });

    // Replace the previous transcript; a new proposal resets both acceptances.
    const { updated, rows } = await prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { milestoneId, kind: "MEDIATION" } });
      const rows = [];
      for (const t of turns) rows.push(await tx.review.create({ data: { milestoneId, kind: "MEDIATION", result: t } }));
      const updated = await tx.mediation.update({
        where: { id: mediation.id },
        data: { proposedReleasePercent: percent, rationale: out.rationale, status: "OPEN" },
      });
      return { updated, rows };
    });

    await logEvent(milestoneId, "MEDIATION_PROPOSED", {
      mediationId: mediation.id,
      proposedReleasePercent: percent,
      previousPercent: mediation.proposedReleasePercent,
      rounds: round,
    });
    const res: MediateResponse = { mediation: toMediationDTO(updated), turns: rows.map(toReviewDTO) };
    return NextResponse.json(res);
  } catch (error) {
    return errorResponse(error, "Mediation failed");
  }
}
