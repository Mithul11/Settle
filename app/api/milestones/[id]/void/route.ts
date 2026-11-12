import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { describePayPalError, voidAuthorization } from "@/lib/paypal";
import {
  canTransition,
  hasAuthorization,
  MILESTONE_STATUS,
  NO_AUTHORIZATION_MESSAGE,
  paypalRequestId,
} from "@/lib/status";

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
  if (!canTransition(milestone.status, "void")) {
    return NextResponse.json(
      { error: `Milestone is ${milestone.status}, there is nothing to void` },
      { status: 409 },
    );
  }
  if (!hasAuthorization(milestone)) {
    return NextResponse.json({ error: NO_AUTHORIZATION_MESSAGE }, { status: 409 });
  }

  try {
    await voidAuthorization(
      milestone.authorizationId,
      paypalRequestId.void(milestone.id),
    );

    // Only move to VOIDED if nothing else (for example a release) got there first.
    const updated = await prisma.milestone.updateMany({
      where: { id, status: milestone.status },
      data: {
        status: MILESTONE_STATUS.VOIDED,
        refundedAmount: milestone.amount,
        heldAmount: 0,
      },
    });
    const refundedAmount = milestone.amount.toFixed(2);
    await logEvent(id, "VOIDED", {
      authorizationId: milestone.authorizationId,
      amount: refundedAmount,
    });

    return NextResponse.json({
      status: updated.count ? MILESTONE_STATUS.VOIDED : milestone.status,
      refundedAmount,
    });
  } catch (error) {
    const info = describePayPalError(error);
    console.error("void failed", info);
    await logEvent(id, "PAYMENT_FAILED", { action: "void", ...info });
    return NextResponse.json(
      { error: info.message, details: info.details },
      { status: 502 },
    );
  }
}
