import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { describePayPalError, voidAuthorization } from "@/lib/paypal";
import { HELD_STATUSES, MILESTONE_STATUS } from "@/lib/status";

// POST /api/milestones/:id/void
// Voids the authorization: the hold is released back to the client.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const milestone = await prisma.milestone.findUnique({ where: { id } });
  if (!milestone) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }
  if (!milestone.authorizationId || !HELD_STATUSES.includes(milestone.status)) {
    return NextResponse.json(
      { error: `Milestone is ${milestone.status}, there is nothing to void` },
      { status: 409 },
    );
  }

  try {
    await voidAuthorization(milestone.authorizationId, `void-${milestone.id}`);

    // Only move to VOIDED if nothing else (for example a release) got there first.
    const updated = await prisma.milestone.updateMany({
      where: { id, status: milestone.status },
      data: { status: MILESTONE_STATUS.VOIDED },
    });
    await logEvent(id, "AUTHORIZATION_VOIDED", {
      authorizationId: milestone.authorizationId,
    });

    return NextResponse.json({
      status: updated.count ? MILESTONE_STATUS.VOIDED : milestone.status,
    });
  } catch (error) {
    const info = describePayPalError(error);
    console.error("void failed", info);
    await logEvent(id, "AUTHORIZATION_VOID_FAILED", info);
    return NextResponse.json(
      { error: info.message, details: info.details },
      { status: 502 },
    );
  }
}
