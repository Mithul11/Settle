import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { errorResponse, parseBody } from "@/lib/http";
import type { CreateDealResponse } from "@/lib/types";

const Body = z.object({
  title: z.string().trim().min(1).max(200),
  brief: z.string().trim().min(1).max(5000),
  clientName: z.string().trim().min(1).max(120),
  clientEmail: z.string().trim().email(),
  freelancerName: z.string().trim().min(1).max(120).optional(),
  milestones: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        criteria: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
        // Positive, at most 2 decimals, below a sane ceiling for the sandbox.
        amountUSD: z
          .number()
          .positive()
          .max(100000)
          .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, "at most 2 decimals"),
      }),
    )
    .min(1)
    .max(12),
});

// POST /api/deals -> 201 { id }. Milestones start in DRAFT, unfunded.
export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if ("response" in body) return body.response;
  const d = body.data;
  try {
    const deal = await prisma.deal.create({
      data: {
        title: d.title,
        brief: d.brief,
        clientName: d.clientName,
        clientEmail: d.clientEmail,
        freelancerName: d.freelancerName ?? "Freelancer",
        milestones: {
          create: d.milestones.map((m, i) => ({
            position: i,
            title: m.title,
            criteria: m.criteria,
            amount: m.amountUSD.toFixed(2),
          })),
        },
      },
      select: { id: true },
    });
    const res: CreateDealResponse = { id: deal.id };
    return NextResponse.json(res, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Could not create the deal");
  }
}
