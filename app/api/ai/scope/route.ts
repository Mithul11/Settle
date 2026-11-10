import { NextResponse } from "next/server";

// TODO(scoper): generateObject({ model, schema: ScoperOutputSchema }) from a job
// brief, then create the Deal and its Milestones.
export async function POST() {
  return NextResponse.json(
    { error: "Scoper agent is not implemented yet" },
    { status: 501 },
  );
}
