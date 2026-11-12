import type { Prisma, PrismaClient } from "@prisma/client";
import type { ReviewOutput } from "./ai";

/** Fixed id so the demo deal always lives at /deals/demo. */
export const DEMO_DEAL_ID = "demo";

// Demo records are display data only. isDemo is true and no row carries a
// PayPal order, authorization or capture id, so payment routes answer 409
// and the dashboard totals leave them out.
const DEMO_DELIVERABLE_URL = "https://github.com/octocat/Hello-World";

const DEMO_REVIEW: ReviewOutput = {
  criteria: [
    {
      name: "POST /api/waitlist validates the email and stores the signup",
      pass: true,
      evidence:
        "app/api/waitlist/route.ts checks the email with a schema before the insert.",
    },
    {
      name: "Duplicate emails are rejected with a 409",
      pass: true,
      evidence:
        "The route catches the unique constraint error and returns status 409.",
    },
    {
      name: "Automated tests cover the success and failure paths",
      pass: false,
      evidence:
        "tests/waitlist.test.ts covers the success path only; no duplicate-email test.",
    },
  ],
  verdict: "PASS",
  score: 78,
};

function demoMilestones(): Prisma.MilestoneCreateWithoutDealInput[] {
  return [
    {
      position: 0,
      title: "Responsive landing page",
      amount: "50.00",
      status: "DRAFT",
      criteria: [
        "Hero, features and pricing sections are present",
        "Layout works at 375px and 1280px widths",
        "README explains how to run the project locally",
      ],
    },
    {
      position: 1,
      title: "Pricing page with plan toggle",
      amount: "80.00",
      status: "FUNDED",
      heldAmount: "80.00",
      criteria: [
        "Monthly and yearly prices switch with one toggle",
        "Each plan lists its features",
        "The page passes an automated accessibility check",
      ],
      events: {
        create: [
          { type: "FUNDED", payload: { demo: true, amount: "80.00" } },
        ],
      },
    },
    {
      position: 2,
      title: "Waitlist API with tests",
      amount: "120.00",
      status: "REVIEWED",
      heldAmount: "120.00",
      deliverableUrl: DEMO_DELIVERABLE_URL,
      deliverableNote: "API and tests are on the main branch.",
      reviewScore: DEMO_REVIEW.score,
      reviewVerdict: DEMO_REVIEW.verdict,
      criteria: DEMO_REVIEW.criteria.map((c) => c.name),
      reviews: {
        create: [
          {
            kind: "REVIEW",
            verdict: DEMO_REVIEW.verdict,
            score: DEMO_REVIEW.score,
            result: DEMO_REVIEW,
            deliverableUrl: DEMO_DELIVERABLE_URL,
          },
        ],
      },
      events: {
        create: [
          { type: "FUNDED", payload: { demo: true, amount: "120.00" } },
          {
            type: "SUBMITTED",
            payload: { demo: true, deliverableUrl: DEMO_DELIVERABLE_URL },
          },
          {
            type: "REVIEWED",
            payload: {
              demo: true,
              verdict: DEMO_REVIEW.verdict,
              score: DEMO_REVIEW.score,
            },
          },
        ],
      },
    },
  ];
}

/** Create the demo deal if it does not exist. Leaves an existing one alone. */
export async function ensureDemoDeal(prisma: PrismaClient) {
  const existing = await prisma.deal.findUnique({ where: { id: DEMO_DEAL_ID } });
  if (existing) return existing;
  try {
    return await prisma.deal.create({
      data: {
        id: DEMO_DEAL_ID,
        isDemo: true,
        title: "Landing page + waitlist API",
        brief:
          "Build a responsive marketing landing page, a pricing page and a small waitlist API for a SaaS launch.",
        clientName: "Acme Labs",
        clientEmail: "client@example.com",
        freelancerName: "Mithul",
        milestones: { create: demoMilestones() },
      },
    });
  } catch (error) {
    // Two first visits at once: the other request created it.
    const created = await prisma.deal.findUnique({ where: { id: DEMO_DEAL_ID } });
    if (created) return created;
    throw error;
  }
}

/**
 * Delete and recreate the demo deal: milestones are back in DRAFT, FUNDED
 * and REVIEWED. Only ever touches the row with id "demo".
 */
export async function resetDemoDeal(prisma: PrismaClient) {
  await prisma.deal.deleteMany({ where: { id: DEMO_DEAL_ID, isDemo: true } });
  return ensureDemoDeal(prisma);
}
