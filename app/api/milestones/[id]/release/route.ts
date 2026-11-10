import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { captureAuthorization, describePayPalError } from "@/lib/paypal";
import { HELD_STATUSES, MILESTONE_STATUS } from "@/lib/status";

// POST /api/milestones/:id/release
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
  if (!milestone.authorizationId || !HELD_STATUSES.includes(milestone.status)) {
    return NextResponse.json(
      { error: `Milestone is ${milestone.status}, there is nothing to release` },
      { status: 409 },
    );
  }

  // Claim the milestone first so two concurrent requests cannot both capture.
  const claimed = await prisma.milestone.updateMany({
    where: { id, status: milestone.status },
    data: { status: MILESTONE_STATUS.RELEASE_PENDING },
  });
  if (claimed.count === 0) {
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
      `release-${milestone.id}`,
    );

    // PENDING captures are completed later by the PAYMENT.CAPTURE.COMPLETED webhook.
    const status =
      capture.status === "COMPLETED"
        ? MILESTONE_STATUS.RELEASED
        : MILESTONE_STATUS.RELEASE_PENDING;

    await prisma.milestone.update({
      where: { id },
      data: {
        status,
        captureId: capture.id,
        capturedAmount: capture.amount?.value ?? milestone.amount,
      },
    });
    await logEvent(id, "PAYMENT_RELEASED", {
      captureId: capture.id,
      captureStatus: capture.status,
      amount: capture.amount,
    });

    return NextResponse.json({ status, captureId: capture.id });
  } catch (error) {
    // Put the milestone back so the release can be retried.
    await prisma.milestone.updateMany({
      where: { id, status: MILESTONE_STATUS.RELEASE_PENDING },
      data: { status: milestone.status },
    });
    const info = describePayPalError(error);
    console.error("release failed", info);
    await logEvent(id, "PAYMENT_RELEASE_FAILED", info);
    return NextResponse.json(
      { error: info.message, details: info.details },
      { status: 502 },
    );
  }
}
