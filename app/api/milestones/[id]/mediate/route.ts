import { NextResponse } from "next/server";

// TODO(mediators): generateObject({ model, schema: MediationOutputSchema }),
// then captureAuthorization(authId, amount * proposedReleasePercent / 100, true)
// so PayPal voids the remainder.
export async function POST() {
  return NextResponse.json(
    { error: "Mediator agents are not implemented yet" },
    { status: 501 },
  );
}
