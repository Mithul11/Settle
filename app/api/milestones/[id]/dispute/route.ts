import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { errorResponse, jsonError, parseBody } from "@/lib/http";
import { toMediationDTO } from "@/lib/serialize";
import { MILESTONE_STATUS } from "@/lib/status";
import type { DisputeResponse } from "@/lib/types";

// Opens a dispute. Funds stay authorized; nothing is captured or voided here.
// This route must never import lib/paypal.ts.

const Body = z.object({ reason: z.string().trim().max(2000).optional() });

// POST /api/milestones/:id/dispute { reason? }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(request, Body);
  if ("response" in body) return body.response;
  const reason = body.data.reason || null;

  try {
    const mediation = await prisma.$transaction(async (tx) => {
      const moved = await tx.milestone.updateMany({
        where: { id, status: MILESTONE_STATUS.REVIEWED },
        data: { status: MILESTONE_STATUS.DISPUTED },
      });
      if (moved.count !== 1) return null;
      return tx.mediation.create({ data: { milestoneId: id, status: "OPEN" } });
    });

    if (!mediation) {
      const m = await prisma.milestone.findUnique({ where: { id }, select: { status: true } });
      if (!m) return jsonError(404, "Milestone not found");
      return jsonError(409, `Milestone is ${m.status}; only reviewed work can be disputed`);
    }
    await logEvent(id, "DISPUTED", { reason, mediationId: mediation.id });
    const res: DisputeResponse = { status: MILESTONE_STATUS.DISPUTED, mediation: toMediationDTO(mediation) };
    return NextResponse.json(res);
  } catch (error) {
    return errorResponse(error, "Could not open the dispute");
  }
}
