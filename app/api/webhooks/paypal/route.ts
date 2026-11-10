import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { verifyWebhookSignature } from "@/lib/paypal";
import { MILESTONE_STATUS } from "@/lib/status";

type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    amount?: { value?: string; currency_code?: string };
    supplementary_data?: {
      related_ids?: { order_id?: string; authorization_id?: string };
    };
  };
};

const SETTLED: string[] = [
  MILESTONE_STATUS.RELEASED,
  MILESTONE_STATUS.PARTIALLY_RELEASED,
];

// POST /api/webhooks/paypal
export async function POST(request: Request) {
  // Read the body as text: the signature covers the exact bytes PayPal sent.
  const rawBody = await request.text();

  let verified = false;
  try {
    verified = await verifyWebhookSignature(request.headers, rawBody);
  } catch (error) {
    console.error("webhook verification errored", error);
    // 500 so PayPal retries once the configuration is fixed.
    return NextResponse.json({ error: "Verification unavailable" }, { status: 500 });
  }
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as PayPalWebhookEvent;
  const resource = event.resource ?? {};
  const related = resource.supplementary_data?.related_ids ?? {};
  let milestoneId: string | null = null;

  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const or: { authorizationId?: string; orderId?: string; captureId?: string }[] = [];
    if (related.authorization_id) or.push({ authorizationId: related.authorization_id });
    if (related.order_id) or.push({ orderId: related.order_id });
    if (resource.id) or.push({ captureId: resource.id });

    const milestone = or.length
      ? await prisma.milestone.findFirst({ where: { OR: or } })
      : null;

    if (milestone) {
      milestoneId = milestone.id;
      const captured = resource.amount?.value;
      const isFull =
        captured === undefined || Number(captured) >= Number(milestone.amount);
      await prisma.milestone.update({
        where: { id: milestone.id },
        data: {
          status: isFull
            ? MILESTONE_STATUS.RELEASED
            : MILESTONE_STATUS.PARTIALLY_RELEASED,
          captureId: resource.id ?? milestone.captureId,
          ...(captured !== undefined && { capturedAmount: captured }),
        },
      });
    }
  } else if (event.event_type === "PAYMENT.AUTHORIZATION.VOIDED" && resource.id) {
    const milestone = await prisma.milestone.findUnique({
      where: { authorizationId: resource.id },
    });
    if (milestone) {
      milestoneId = milestone.id;
      // A partial final capture also voids the remainder: do not undo a release.
      if (!SETTLED.includes(milestone.status)) {
        await prisma.milestone.update({
          where: { id: milestone.id },
          data: { status: MILESTONE_STATUS.VOIDED },
        });
      }
    }
  }

  await logEvent(milestoneId, `WEBHOOK:${event.event_type ?? "UNKNOWN"}`, {
    eventId: event.id,
    resourceId: resource.id,
    amount: resource.amount,
    related,
  });

  return NextResponse.json({ received: true });
}
