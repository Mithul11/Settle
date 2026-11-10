import type { PrismaClient } from "@prisma/client";

/** Fixed id so the demo deal always lives at /deals/demo. */
export const DEMO_DEAL_ID = "demo";

const DEMO_DEAL = {
  id: DEMO_DEAL_ID,
  title: "Landing page + waitlist API",
  brief:
    "Build a responsive marketing landing page and a small waitlist API for a SaaS launch.",
  clientName: "Acme Labs",
  freelancerName: "Mithul",
  repoUrl: null,
};

const DEMO_MILESTONES = [
  {
    position: 0,
    title: "Responsive landing page",
    amount: "50.00",
    criteria: [
      "Hero, features and pricing sections are present",
      "Layout works at 375px and 1280px widths",
      "README explains how to run the project locally",
    ],
  },
  {
    position: 1,
    title: "Waitlist API with tests",
    amount: "120.00",
    criteria: [
      "POST /api/waitlist validates the email and stores the signup",
      "Duplicate emails are rejected with a 409",
      "Automated tests cover the success and failure paths",
    ],
  },
];

/** Create the demo deal if it does not exist. Leaves an existing one alone. */
export async function ensureDemoDeal(prisma: PrismaClient) {
  const existing = await prisma.deal.findUnique({ where: { id: DEMO_DEAL_ID } });
  if (existing) return existing;
  return prisma.deal.create({
    data: { ...DEMO_DEAL, milestones: { create: DEMO_MILESTONES } },
  });
}

/** Delete and recreate the demo deal, so both milestones are PENDING again. */
export async function resetDemoDeal(prisma: PrismaClient) {
  await prisma.deal.deleteMany({ where: { id: DEMO_DEAL_ID } });
  return ensureDemoDeal(prisma);
}
