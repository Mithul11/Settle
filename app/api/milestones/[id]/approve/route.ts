import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { captureAuthorization, describePayPalError } from "@/lib/paypal";
import {
  canTransition,
  hasAuthorization,
  MILESTONE_STATUS,
  NO_AUTHORIZATION_MESSAGE,
  paypalRequestId,
} from "@/lib/status";

// POST /api/milestones/:id/approve
// Full capture of the held authorization: the freelancer gets paid.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const milestone = await prisma.milestone.findUnique({ where: { id } });
  if (!milestone) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }
  if (!canTransition(milestone.status, "approve")) {
    return NextResponse.json(
      { error: `Milestone is ${milestone.status}, there is nothing to release` },
      { status: 409 },
    );
  }
  if (!hasAuthorization(milestone)) {
    return NextResponse.json({ error: NO_AUTHORIZATION_MESSAGE }, { status: 409 });
  }

  // Claim the milestone first so two concurrent requests cannot both capture.
  const claimed = await prisma.milestone.updateMany({
    where: { id, status: MILESTONE_STATUS.REVIEWED },
    data: { status: MILESTONE_STATUS.RELEASED },
  });
  if (claimed.count !== 1) {
    return NextResponse.json(
      { error: "Milestone is already being processed" },
      { status: 409 },
    );
  }

  try {
    const capture = await captureAuthorization(
      milestone.authorizationId,
      undefined, // full amount
      true,
      paypalRequestId.approve(milestone.id),
    );
    if (!capture.id || capture.status === "DECLINED" || capture.status === "FAILED") {
      throw new Error(`Capture was not accepted (${capture.status ?? "no status"})`);
    }

    const releasedAmount = milestone.amount.toFixed(2);
    await prisma.milestone.update({
      where: { id },
      data: {
        captureId: capture.id,
        releasedAmount: milestone.amount,
        heldAmount: 0,
      },
    });
    await logEvent(id, "RELEASED", {
      authorizationId: milestone.authorizationId,
      captureId: capture.id,
      captureStatus: capture.status,
      amount: releasedAmount,
    });

    return NextResponse.json({
      status: MILESTONE_STATUS.RELEASED,
      captureId: capture.id,
      releasedAmount,
    });
  } catch (error) {
    // Put the milestone back so the release can be retried.
    await prisma.milestone.updateMany({
      where: { id, status: MILESTONE_STATUS.RELEASED, captureId: null },
      data: { status: MILESTONE_STATUS.REVIEWED },
    });
    const info = describePayPalError(error);
    console.error("release failed", info);
    await logEvent(id, "PAYMENT_FAILED", { action: "approve", ...info });
    return NextResponse.json(
      { error: info.message, details: info.details },
      { status: 502 },
    );
  }
}
