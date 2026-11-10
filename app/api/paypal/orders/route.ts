import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { createAuthorizeOrder, describePayPalError } from "@/lib/paypal";
import { MILESTONE_STATUS } from "@/lib/status";

// POST /api/paypal/orders  { milestoneId }
// Creates an AUTHORIZE order for the milestone and saves the order id.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    milestoneId?: unknown;
  } | null;
  const milestoneId = body?.milestoneId;
  if (typeof milestoneId !== "string" || !milestoneId) {
    return NextResponse.json({ error: "milestoneId is required" }, { status: 400 });
  }

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { deal: true },
  });
  if (!milestone) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }
  if (milestone.status !== MILESTONE_STATUS.PENDING) {
    return NextResponse.json(
      { error: `Milestone is ${milestone.status}, it cannot be funded again` },
      { status: 409 },
    );
  }

  try {
    // The amount always comes from the database, never from the browser.
    const order = await createAuthorizeOrder(
      milestone.amount.toFixed(2),
      `${milestone.deal.title}: ${milestone.title}`,
      { customId: milestone.id },
    );
    if (!order.id) throw new Error("PayPal did not return an order id");

    await prisma.milestone.update({
      where: { id: milestone.id },
      data: { orderId: order.id },
    });
    await logEvent(milestone.id, "ORDER_CREATED", {
      orderId: order.id,
      status: order.status,
      amount: milestone.amount.toFixed(2),
    });

    return NextResponse.json({ orderId: order.id });
  } catch (error) {
    const info = describePayPalError(error);
    console.error("create order failed", info);
    return NextResponse.json(
      { error: info.message, details: info.details },
      { status: 502 },
    );
  }
}
