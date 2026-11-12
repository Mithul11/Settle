import { Prisma, type Milestone } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { PayPalConfigError, verifyWebhookSignature } from "@/lib/paypal";
import { isFinalStatus, MILESTONE_STATUS } from "@/lib/status";

// POST /api/webhooks/paypal
//
// Rules (docs/settle-spec.md section 5):
// - Nothing is trusted until PayPal's verify-webhook-signature says SUCCESS.
// - A webhook never starts a payment and never marks a milestone RELEASED or
//   SETTLED: captures are started only by the approve and settlement routes.
// - Each PayPal event id is processed once (idempotent on redelivery).
// - Every verified delivery is written to the Event table (audit trail).
//
// Responses: 200 processed / duplicate / ignored type, 400 bad signature,
// 503 missing configuration, 500 transient failure (PayPal redelivers).

const HANDLED = [
  "PAYMENT.AUTHORIZATION.CREATED",
  "PAYMENT.AUTHORIZATION.VOIDED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.DENIED",
  "PAYMENT.CAPTURE.PENDING",
] as const;
type HandledType = (typeof HANDLED)[number];

type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
    amount?: { value?: string; currency_code?: string };
    status_details?: { reason?: string };
    supplementary_data?: {
      related_ids?: { order_id?: string; authorization_id?: string; capture_id?: string };
    };
  };
};

type Outcome = { milestoneId: string | null; result: string; detail?: Record<string, unknown> };

const isAuthEvent = (t: HandledType) => t.startsWith("PAYMENT.AUTHORIZATION.");

/**
 * Find the milestone this event belongs to, and check that every PayPal id
 * the event carries matches the ids stored on that milestone.
 */
async function matchMilestone(type: HandledType, event: PayPalWebhookEvent) {
  const resource = event.resource ?? {};
  const related = resource.supplementary_data?.related_ids ?? {};
  // For authorization events the resource itself is the authorization.
  const authorizationId = isAuthEvent(type) ? resource.id : related.authorization_id;
  const captureId = isAuthEvent(type) ? undefined : resource.id;
  const orderId = related.order_id;

  const or: Prisma.MilestoneWhereInput[] = [];
  if (authorizationId) or.push({ authorizationId });
  if (orderId) or.push({ orderId });
  if (captureId) or.push({ captureId });
  if (!or.length) return { milestone: null, mismatch: null };

  const candidates = await prisma.milestone.findMany({ where: { OR: or }, take: 2 });
  if (candidates.length > 1) return { milestone: null, mismatch: "event ids match more than one milestone" };
  const m = candidates[0];
  if (!m) return { milestone: null, mismatch: null };

  const conflicts: string[] = [];
  if (authorizationId && m.authorizationId && m.authorizationId !== authorizationId) conflicts.push("authorization id");
  if (orderId && m.orderId && m.orderId !== orderId) conflicts.push("order id");
  if (captureId && m.captureId && m.captureId !== captureId) conflicts.push("capture id");
  return { milestone: m, mismatch: conflicts.length ? `${conflicts.join(", ")} does not match the milestone` : null };
}

function sameAmount(m: Milestone, value?: string) {
  return value !== undefined && Number(value).toFixed(2) === m.amount.toFixed(2);
}

async function handle(type: HandledType, event: PayPalWebhookEvent): Promise<Outcome> {
  const resource = event.resource ?? {};
  const { milestone: m, mismatch } = await matchMilestone(type, event);
  if (mismatch) return { milestoneId: m?.id ?? null, result: "ID_MISMATCH", detail: { mismatch } };
  if (!m) return { milestoneId: null, result: "NO_MATCHING_MILESTONE" };

  switch (type) {
    case "PAYMENT.AUTHORIZATION.CREATED": {
      // Normally the authorize route already set FUNDED from PayPal's API
      // response. This only reconciles the case where that request died after
      // PayPal placed the hold: verified event, same order, same amount, hold
      // in CREATED. It records an existing authorization; it never creates one.
      if (m.authorizationId) return { milestoneId: m.id, result: "ALREADY_RECORDED" };
      if (m.status !== MILESTONE_STATUS.DRAFT || resource.status !== "CREATED" || !sameAmount(m, resource.amount?.value)) {
        return {
          milestoneId: m.id,
          result: "NOT_RECONCILED",
          detail: { milestoneStatus: m.status, authorizationStatus: resource.status ?? null },
        };
      }
      const updated = await prisma.milestone.updateMany({
        where: { id: m.id, status: MILESTONE_STATUS.DRAFT, authorizationId: null },
        data: {
          authorizationId: resource.id,
          status: MILESTONE_STATUS.FUNDED,
          heldAmount: m.amount,
          releasedAmount: 0,
          refundedAmount: 0,
          captureId: null,
        },
      });
      if (updated.count !== 1) return { milestoneId: m.id, result: "ALREADY_RECORDED" };
      await logEvent(m.id, "FUNDED", {
        source: "webhook",
        orderId: m.orderId,
        authorizationId: resource.id,
        amount: m.amount.toFixed(2),
      });
      return { milestoneId: m.id, result: "RECONCILED_FUNDED" };
    }

    case "PAYMENT.AUTHORIZATION.VOIDED": {
      // Voids can also come from PayPal itself (an expired authorization).
      // Never move RELEASED / SETTLED backwards; a DISPUTED milestone is left
      // to the settlement flow, which reports the remainder status.
      if (m.status === MILESTONE_STATUS.VOIDED) return { milestoneId: m.id, result: "ALREADY_VOIDED" };
      if (isFinalStatus(m.status) || m.status === MILESTONE_STATUS.DISPUTED) {
        return { milestoneId: m.id, result: "VOID_NOT_APPLIED", detail: { milestoneStatus: m.status } };
      }
      const updated = await prisma.milestone.updateMany({
        where: { id: m.id, status: m.status },
        data: { status: MILESTONE_STATUS.VOIDED, refundedAmount: m.heldAmount, heldAmount: 0 },
      });
      if (updated.count !== 1) return { milestoneId: m.id, result: "STATUS_CHANGED_CONCURRENTLY" };
      await logEvent(m.id, "VOIDED", {
        source: "webhook",
        authorizationId: resource.id,
        refundedAmount: m.heldAmount.toFixed(2),
      });
      return { milestoneId: m.id, result: "MARKED_VOIDED" };
    }

    case "PAYMENT.CAPTURE.COMPLETED": {
      // Confirms a capture that the approve or settlement route started. It
      // never sets RELEASED/SETTLED and never changes amounts.
      const expected: string[] = [MILESTONE_STATUS.RELEASED, MILESTONE_STATUS.SETTLED, MILESTONE_STATUS.DISPUTED];
      if (!expected.includes(m.status)) {
        return {
          milestoneId: m.id,
          result: "UNEXPECTED_CAPTURE",
          detail: { milestoneStatus: m.status, captureId: resource.id ?? null },
        };
      }
      if (resource.id && !m.captureId) {
        await prisma.milestone.updateMany({ where: { id: m.id, captureId: null }, data: { captureId: resource.id } });
        return { milestoneId: m.id, result: "CAPTURE_CONFIRMED_ID_RECORDED" };
      }
      return { milestoneId: m.id, result: "CAPTURE_CONFIRMED" };
    }

    case "PAYMENT.CAPTURE.DENIED":
    case "PAYMENT.CAPTURE.PENDING": {
      // The money did not (or not yet) move. The status is left as is and the
      // problem is put in the audit trail for follow-up; nothing is retried.
      const denied = type === "PAYMENT.CAPTURE.DENIED";
      await logEvent(m.id, "PAYMENT_FAILED", {
        source: "webhook",
        action: denied ? "capture_denied" : "capture_pending",
        captureId: resource.id,
        reason: resource.status_details?.reason,
        milestoneStatus: m.status,
      });
      return { milestoneId: m.id, result: denied ? "CAPTURE_DENIED_FLAGGED" : "CAPTURE_PENDING_FLAGGED" };
    }
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(request: Request) {
  // Read the body as text: the signature covers the exact bytes PayPal sent.
  const rawBody = await request.text();

  let verification: "SUCCESS" | "FAILURE";
  try {
    verification = await verifyWebhookSignature(request.headers, rawBody);
  } catch (error) {
    if (error instanceof PayPalConfigError) {
      // Variable names only, never values.
      console.warn(`PayPal webhook rejected: ${error.message}`);
      return NextResponse.json(
        { error: "Webhook verification is not configured", details: { missing: error.missing } },
        { status: 503 },
      );
    }
    console.error("PayPal webhook verification errored:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Verification unavailable" }, { status: 500 });
  }
  if (verification !== "SUCCESS") {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as PayPalWebhookEvent;
  const type = event.event_type ?? "UNKNOWN";
  if (!event.id) return NextResponse.json({ error: "Event has no id" }, { status: 400 });

  // Idempotency: claim the PayPal event id by inserting its audit row with a
  // deterministic primary key. A redelivery hits the unique key and stops.
  const auditId = `paypal-webhook-${event.id}`;
  try {
    await prisma.event.create({
      data: {
        id: auditId,
        milestoneId: null,
        type: "WEBHOOK_RECEIVED",
        payload: toJson({ eventId: event.id, eventType: type, resourceId: event.resource?.id, result: "PROCESSING" }),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("PayPal webhook: could not record event:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not record event" }, { status: 500 });
  }

  if (!(HANDLED as readonly string[]).includes(type)) {
    await prisma.event.update({
      where: { id: auditId },
      data: { payload: toJson({ eventId: event.id, eventType: type, result: "IGNORED_TYPE" }) },
    });
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    const outcome = await handle(type as HandledType, event);
    const resource = event.resource ?? {};
    await prisma.event.update({
      where: { id: auditId },
      data: {
        milestoneId: outcome.milestoneId,
        payload: toJson({
          eventId: event.id,
          eventType: type,
          resourceId: resource.id,
          resourceStatus: resource.status,
          amount: resource.amount,
          related: resource.supplementary_data?.related_ids,
          result: outcome.result,
          ...outcome.detail,
        }),
      },
    });
    return NextResponse.json({ received: true, result: outcome.result });
  } catch (error) {
    // Release the claim so PayPal's redelivery is processed again.
    await prisma.event.delete({ where: { id: auditId } }).catch(() => {});
    console.error("PayPal webhook processing failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
