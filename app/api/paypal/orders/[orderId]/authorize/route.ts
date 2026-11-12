import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import {
  authorizeOrder,
  describePayPalError,
  firstAuthorization,
} from "@/lib/paypal";
import { canTransition, MILESTONE_STATUS } from "@/lib/status";

// POST /api/paypal/orders/:orderId/authorize
// Called after the buyer approves. Places the hold and marks the milestone FUNDED.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;

  const milestone = await prisma.milestone.findUnique({ where: { orderId } });
  if (!milestone) {
    return NextResponse.json(
      { error: "No milestone for this order" },
      { status: 404 },
    );
  }
  if (!canTransition(milestone.status, "authorize")) {
    return NextResponse.json(
      { error: `Milestone is already ${milestone.status}` },
      { status: 409 },
    );
  }

  try {
    // The request id makes a retried or double-clicked authorize safe.
    const order = await authorizeOrder(orderId, `authorize-${orderId}`);
    const authorization = firstAuthorization(order);
    if (!authorization?.id) {
      throw new Error("PayPal did not return an authorization");
    }

    const held = authorization.status === "CREATED";
    await prisma.milestone.update({
      where: { id: milestone.id },
      data: {
        authorizationId: authorization.id,
        ...(held && {
          status: MILESTONE_STATUS.FUNDED,
          heldAmount: milestone.amount,
          refundedAmount: 0,
          releasedAmount: 0,
          captureId: null,
        }),
      },
    });
    await logEvent(milestone.id, held ? "FUNDED" : "PAYMENT_FAILED", {
      orderId,
      authorizationId: authorization.id,
      authorizationStatus: authorization.status,
      amount: authorization.amount,
      expirationTime: authorization.expirationTime,
    });

    if (!held) {
      return NextResponse.json(
        { error: `Authorization is ${authorization.status}, funds are not held` },
        { status: 422 },
      );
    }
    return NextResponse.json({
      status: MILESTONE_STATUS.FUNDED,
      authorizationId: authorization.id,
    });
  } catch (error) {
    const info = describePayPalError(error);
    console.error("authorize order failed", info);
    return NextResponse.json(
      { error: info.message, details: info.details },
      { status: 502 },
    );
  }
}
