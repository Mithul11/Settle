import "server-only";
import type { ReviewOutput } from "./ai";
import { reviewDeliverable } from "./agents";
import { prisma } from "./db";
import { logEvent } from "./events";
import { fetchRepoContext } from "./github";
import { HttpError } from "./http";
import { toReviewDTO } from "./serialize";
import { MILESTONE_STATUS } from "./status";
import type { ReviewDTO } from "./types";

// Runs the AI Reviewer for a SUBMITTED milestone and moves it to REVIEWED.
// Reads and records only: it never calls PayPal (no lib/paypal import).

/** Keep the model's output consistent: UNVERIFIABLE/FAIL never pass; any FAIL fails overall. */
function normalize(out: ReviewOutput, agreed: string[]): ReviewOutput {
  const criteria = out.criteria.map((c, i) => {
    const verdict = c.verdict ?? (c.pass ? "PASS" : "FAIL");
    // Use the agreed criterion text (the model sometimes echoes "1. ..." numbering).
    const name = agreed[i] ?? c.name.replace(/^\s*\d+[.)]\s*/, "");
    return { ...c, name, verdict, pass: verdict === "PASS" };
  });
  const anyFail = criteria.some((c) => c.verdict === "FAIL");
  return {
    criteria,
    verdict: anyFail ? "FAIL" : out.verdict,
    score: Math.max(0, Math.min(100, Math.round(out.score))),
  };
}

/**
 * Review the milestone's current deliverable.
 * `useCache`: return the existing review for the same URL instead of calling
 * Gemini again (the "Run AI review" route). Submit passes false, because a
 * resubmission of the same URL usually has new commits.
 */
export async function runReview(milestoneId: string, { useCache }: { useCache: boolean }): Promise<{ review: ReviewDTO; cached: boolean }> {
  const m = await prisma.milestone.findUnique({ where: { id: milestoneId } });
  if (!m) throw new HttpError(404, "Milestone not found");
  if (!m.deliverableUrl) throw new HttpError(422, "No deliverable has been submitted");

  const existing = await prisma.review.findFirst({
    where: { milestoneId, kind: "REVIEW", deliverableUrl: m.deliverableUrl },
    orderBy: { createdAt: "desc" },
  });

  if (m.status === MILESTONE_STATUS.REVIEWED && existing) {
    return { review: toReviewDTO(existing), cached: true };
  }
  if (m.status !== MILESTONE_STATUS.SUBMITTED) {
    throw new HttpError(409, `Milestone is ${m.status}; only submitted work can be reviewed`);
  }

  let row = useCache ? existing : null;
  const cached = !!row;
  if (!row) {
    let repo;
    try {
      repo = await fetchRepoContext(m.deliverableUrl);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      throw new HttpError(422, `Could not read the repository. Is it public? (${reason})`);
    }
    const criteria = Array.isArray(m.criteria) ? m.criteria.map(String) : [];
    const result = normalize(
      await reviewDeliverable({ milestoneTitle: m.title, criteria, note: m.deliverableNote, repo }),
      criteria,
    );
    row = await prisma.review.create({
      data: {
        milestoneId,
        kind: "REVIEW",
        verdict: result.verdict,
        score: result.score,
        result,
        deliverableUrl: m.deliverableUrl,
      },
    });
  }

  // Only advance if the milestone is still the same submission.
  const moved = await prisma.milestone.updateMany({
    where: { id: milestoneId, status: MILESTONE_STATUS.SUBMITTED, deliverableUrl: m.deliverableUrl },
    data: { status: MILESTONE_STATUS.REVIEWED, reviewScore: row.score, reviewVerdict: row.verdict },
  });
  if (moved.count === 1) {
    await logEvent(milestoneId, "REVIEWED", {
      reviewId: row.id,
      score: row.score,
      verdict: row.verdict,
      deliverableUrl: m.deliverableUrl,
      cached,
    });
  }
  return { review: toReviewDTO(row), cached };
}
