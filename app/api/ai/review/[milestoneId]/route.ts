import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { runReview } from "@/lib/review";
import type { ReviewResponse } from "@/lib/types";

// AI review only: never captures money (no lib/paypal import).
export const maxDuration = 90;

// POST /api/ai/review/:milestoneId -> { review, cached }
// Returns the existing review for the same deliverable instead of calling Gemini again.
export async function POST(_request: Request, { params }: { params: Promise<{ milestoneId: string }> }) {
  const { milestoneId } = await params;
  try {
    const res: ReviewResponse = await runReview(milestoneId, { useCache: true });
    return NextResponse.json(res);
  } catch (error) {
    return errorResponse(error, "AI review failed");
  }
}
