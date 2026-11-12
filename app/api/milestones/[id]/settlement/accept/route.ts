import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { errorResponse, jsonError, parseBody } from "@/lib/http";
import { captureAuthorization, describePayPalError, getAuthorization, voidAuthorization } from "@/lib/paypal";
import {
  hasAuthorization,
  isSettlementCaptureEnabled,
  MEDIATION_ACCEPTABLE,
  MILESTONE_STATUS,
  NO_AUTHORIZATION_MESSAGE,
  paypalRequestId,
} from "@/lib/status";
import { ROLES, type AcceptSettlementResponse, type MediationStatus, type Role } from "@/lib/types";

// POST /api/milestones/:id/settlement/accept { role }
//
// The only place a partial capture happens (spec section 5). Money moves only
// when BOTH parties have accepted AND SETTLEMENT_CAPTURE_ENABLED is "true".
// Claim before capture, stable PayPal-Request-Id, restore on failure.

const Body = z.object({ role: z.enum(ROLES) });

function nextStatus(current: MediationStatus, role: Role): MediationStatus | null {
  if (current === "OPEN") return role === "CLIENT" ? "ACCEPTED_BY_CLIENT" : "ACCEPTED_BY_FREELANCER";
  if (current === "ACCEPTED_BY_FREELANCER" && role === "CLIENT") return "ACCEPTED_BY_BOTH";
  if (current === "ACCEPTED_BY_CLIENT" && role === "FREELANCER") return "ACCEPTED_BY_BOTH";
  return null; // already accepted by this role
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(request, Body);
  if ("response" in body) return body.response;
  const role = body.data.role;

  try {
    const m = await prisma.milestone.findUnique({ where: { id } });
    if (!m) return jsonError(404, "Milestone not found");
    if (m.status === MILESTONE_STATUS.SETTLED) return jsonError(409, "This milestone is already settled");
    if (m.status !== MILESTONE_STATUS.DISPUTED) {
      return jsonError(409, `Milestone is ${m.status}; there is no settlement to accept`);
    }

    const mediation = await prisma.mediation.findFirst({ where: { milestoneId: id }, orderBy: { createdAt: "desc" } });
    if (!mediation) return jsonError(409, "This milestone has no mediation");
    if (mediation.proposedReleasePercent === null) return jsonError(409, "The advocates have not proposed a settlement yet");
    const percent = mediation.proposedReleasePercent;
    const captureOn = isSettlementCaptureEnabled();

    // Step 1: record this party's acceptance (claimed with a status guard).
    let status = mediation.status as MediationStatus;
    if (status !== "ACCEPTED_BY_BOTH") {
      if (!(MEDIATION_ACCEPTABLE as readonly string[]).includes(status)) return jsonError(409, `Mediation is ${status}`);
      const next = nextStatus(status, role);
      if (!next) return jsonError(409, `The ${role.toLowerCase()} has already accepted this settlement`);
      // Refuse before recording a final acceptance that could never be executed.
      if (next === "ACCEPTED_BY_BOTH" && captureOn && !hasAuthorization(m)) {
        return jsonError(409, NO_AUTHORIZATION_MESSAGE);
      }
      const claimed = await prisma.mediation.updateMany({ where: { id: mediation.id, status }, data: { status: next } });
      if (claimed.count !== 1) return jsonError(409, "The settlement changed meanwhile; reload and try again");
      status = next;
      await logEvent(id, "SETTLEMENT_ACCEPTED", {
        role,
        mediationId: mediation.id,
        proposedReleasePercent: percent,
        mediationStatus: next,
      });
    }

    if (status !== "ACCEPTED_BY_BOTH") {
      const res: AcceptSettlementResponse = { mediationStatus: status, milestoneStatus: MILESTONE_STATUS.DISPUTED, settled: false };
      return NextResponse.json(res);
    }
    if (!captureOn) {
      const res: AcceptSettlementResponse = {
        mediationStatus: status,
        milestoneStatus: MILESTONE_STATUS.DISPUTED,
        settled: false,
        pendingReason: 'Settlement capture is disabled (SETTLEMENT_CAPTURE_ENABLED is not "true"). No money was moved.',
      };
      return NextResponse.json(res);
    }
    if (!hasAuthorization(m)) return jsonError(409, NO_AUTHORIZATION_MESSAGE);

    // Step 2: claim the milestone so two requests cannot both capture.
    const claimed = await prisma.milestone.updateMany({
      where: { id, status: MILESTONE_STATUS.DISPUTED, captureId: null },
      data: { status: MILESTONE_STATUS.SETTLED },
    });
    if (claimed.count !== 1) return jsonError(409, "The settlement is already being executed");

    const held = new Prisma.Decimal(m.heldAmount.gt(0) ? m.heldAmount : m.amount);
    const part = held.mul(percent).div(100).toDecimalPlaces(2);
    const requestId = paypalRequestId.settle(mediation.id);

    try {
      let captureId: string | null = null;
      let authStatus: string | undefined;
      if (percent === 0) {
        // Nothing to capture: release the whole hold.
        await voidAuthorization(m.authorizationId, requestId);
        authStatus = "VOIDED";
      } else {
        const capture = await captureAuthorization(
          m.authorizationId,
          percent === 100 ? undefined : part.toFixed(2),
          true,
          requestId,
        );
        if (!capture.id || capture.status === "DECLINED" || capture.status === "FAILED") {
          throw new Error(`Capture was not accepted (${capture.status ?? "no status"})`);
        }
        captureId = capture.id;
        // Do not assume final_capture voided the remainder: ask PayPal.
        authStatus = (await getAuthorization(m.authorizationId).catch(() => null))?.status;
      }

      const released = percent === 0 ? new Prisma.Decimal(0) : percent === 100 ? held : part;
      const remainder = held.minus(released);
      const confirmed = remainder.isZero() || authStatus === "VOIDED" || authStatus === "CAPTURED";
      await prisma.$transaction([
        prisma.milestone.update({
          where: { id },
          data: {
            captureId,
            releasedAmount: released,
            refundedAmount: confirmed ? remainder : 0,
            heldAmount: confirmed ? 0 : remainder,
          },
        }),
        prisma.mediation.update({ where: { id: mediation.id }, data: { status: "SETTLED" } }),
      ]);
      await logEvent(id, "SETTLED", {
        mediationId: mediation.id,
        authorizationId: m.authorizationId,
        captureId,
        proposedReleasePercent: percent,
        releasedAmount: released.toFixed(2),
        refundedAmount: confirmed ? remainder.toFixed(2) : "0.00",
        authorizationStatusAfterCapture: authStatus ?? null,
        ...(confirmed ? {} : { remainderUnconfirmed: true }),
      });

      const res: AcceptSettlementResponse = {
        mediationStatus: "SETTLED",
        milestoneStatus: MILESTONE_STATUS.SETTLED,
        settled: true,
        releasedAmount: released.toFixed(2),
        refundedAmount: confirmed ? remainder.toFixed(2) : "0.00",
        ...(captureId ? { captureId } : {}),
      };
      return NextResponse.json(res);
    } catch (error) {
      // Put the milestone back so the settlement can be retried (same request id).
      await prisma.milestone.updateMany({
        where: { id, status: MILESTONE_STATUS.SETTLED, captureId: null },
        data: { status: MILESTONE_STATUS.DISPUTED },
      });
      const info = describePayPalError(error);
      console.error("settlement capture failed", info.message);
      await logEvent(id, "PAYMENT_FAILED", { action: "settle", mediationId: mediation.id, ...info });
      return jsonError(502, info.message, info.details);
    }
  } catch (error) {
    return errorResponse(error, "Could not accept the settlement");
  }
}
