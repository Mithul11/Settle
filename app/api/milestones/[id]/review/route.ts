import { NextResponse } from "next/server";

// TODO(reviewer): fetchRepoContext(deliverableUrl), then
// generateObject({ model, schema: ReviewOutputSchema }) against the milestone
// criteria, save a Review, and release on PASS.
export async function POST() {
  return NextResponse.json(
    { error: "Reviewer agent is not implemented yet" },
    { status: 501 },
  );
}
