import { NextResponse } from "next/server";
import { z } from "zod";
import { scopeDeal } from "@/lib/agents";
import { errorResponse, parseBody } from "@/lib/http";
import type { ScopeResponse } from "@/lib/types";

export const maxDuration = 60;

const Body = z.object({
  title: z.string().trim().min(1, "title is required").max(200),
  brief: z.string().trim().min(30, "brief must be at least 30 characters").max(5000),
});

// POST /api/ai/scope { title, brief } -> ScoperOutput. Saves nothing.
export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if ("response" in body) return body.response;
  try {
    const out = await scopeDeal(body.data.title, body.data.brief);
    const res: ScopeResponse = {
      milestones: out.milestones.map((m) => ({
        title: m.title.trim(),
        criteria: m.criteria.map((c) => c.trim()).filter(Boolean),
        amountUSD: Math.round(m.amountUSD * 100) / 100,
      })),
    };
    return NextResponse.json(res);
  } catch (error) {
    return errorResponse(error, "AI Scoper failed");
  }
}
