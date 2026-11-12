import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { parseGitHubUrl } from "@/lib/github";
import { errorResponse, HttpError, jsonError, parseBody } from "@/lib/http";
import { runReview } from "@/lib/review";
import { MILESTONE_STATUS } from "@/lib/status";
import type { SubmitResponse } from "@/lib/types";

// Submission + AI review only. This route must never import lib/paypal.ts.
export const maxDuration = 90;

const Body = z.object({
  deliverableUrl: z.string().trim().min(1).max(500),
  note: z.string().trim().max(2000).optional(),
});

function normalizeUrl(input: string) {
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const { owner, repo } = parseGitHubUrl(withScheme); // throws on non-GitHub URLs
  return `https://github.com/${owner}/${repo}`;
}

// POST /api/milestones/:id/submit { deliverableUrl, note? }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(request, Body);
  if ("response" in body) return body.response;

  let url: string;
  try {
    url = normalizeUrl(body.data.deliverableUrl);
  } catch {
    return jsonError(400, "deliverableUrl must be a github.com/<owner>/<repo> URL");
  }

  try {
    const m = await prisma.milestone.findUnique({ where: { id } });
    if (!m) return jsonError(404, "Milestone not found");
    if (m.status === MILESTONE_STATUS.SUBMITTED) {
      return jsonError(
        409,
        m.deliverableUrl === url ? "This repository is already submitted and under review" : "A submission is already under review",
      );
    }

    // Claim the row: only one concurrent submit can move FUNDED/REVIEWED -> SUBMITTED.
    const claimed = await prisma.milestone.updateMany({
      where: { id, status: { in: [MILESTONE_STATUS.FUNDED, MILESTONE_STATUS.REVIEWED] } },
      data: {
        status: MILESTONE_STATUS.SUBMITTED,
        deliverableUrl: url,
        deliverableNote: body.data.note || null,
        reviewScore: null,
        reviewVerdict: null,
      },
    });
    if (claimed.count !== 1) {
      return jsonError(409, `Milestone is ${m.status}; work can be submitted once it is funded`);
    }
    await logEvent(id, "SUBMITTED", { deliverableUrl: url, note: body.data.note ?? null });

    // Review in the same request. A failed review leaves the milestone SUBMITTED.
    try {
      const { review } = await runReview(id, { useCache: false });
      const res: SubmitResponse = { status: MILESTONE_STATUS.REVIEWED, review };
      return NextResponse.json(res);
    } catch (error) {
      const reviewError = error instanceof HttpError ? error.message : "The AI review failed";
      if (!(error instanceof HttpError)) console.error("submit: review failed", error);
      const res: SubmitResponse = { status: MILESTONE_STATUS.SUBMITTED, review: null, reviewError };
      return NextResponse.json(res);
    }
  } catch (error) {
    return errorResponse(error, "Submission failed");
  }
}
