import { NextResponse } from "next/server";
import { errorResponse, jsonError } from "@/lib/http";
import { getDealDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

// GET /api/deals/:id -> DealDetailDTO
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const deal = await getDealDetail(id);
    if (!deal) return jsonError(404, "Deal not found");
    return NextResponse.json(deal);
  } catch (error) {
    return errorResponse(error, "Could not load the deal");
  }
}
