import "server-only";
// Read-side queries for server-rendered pages. Pages read the database
// directly (same DTOs as the API) so the first paint has real data; every
// mutation still goes through the API routes.
import { prisma } from "./db";
import { DEMO_DEAL_ID, ensureDemoDeal } from "./demo-deal";
import {
  DEAL_DETAIL_INCLUDE,
  toDealDetailDTO,
  toDealDTO,
  toEventDTO,
} from "./serialize";
import type { DealDetailDTO, DealDTO, EventDTO } from "./types";

/** False until DATABASE_URL is set (e.g. no .env yet). */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Log a page load failure. A missing DATABASE_URL is a setup step, not a
 * bug, so it is a warning (the Next.js dev overlay counts console.error).
 */
export function logLoadError(where: string, error: unknown) {
  if (!isDbConfigured()) {
    console.warn(`${where}: DATABASE_URL is not set. Copy .env.example to .env and fill it in.`);
    return;
  }
  console.error(`${where}: load failed`, error);
}

export type PaymentRefs = Record<
  string,
  { authorizationId: string | null; captureId: string | null }
>;

export type DashboardData = {
  deals: DealDTO[];
  events: EventDTO[];
  refs: PaymentRefs;
};

export type ShellSummary = {
  held: number;
  captured: number;
  dealCount: number;
  latestDeal: { id: string; title: string } | null;
  events: EventDTO[];
  titles: Record<string, string>;
};

export async function getDashboardData(): Promise<DashboardData> {
  const rows = await prisma.deal.findMany({
    orderBy: { updatedAt: "desc" },
    include: { milestones: { orderBy: { position: "asc" }, include: { events: true } } },
  });
  const refs: PaymentRefs = {};
  const events: EventDTO[] = [];
  for (const d of rows) {
    for (const m of d.milestones) {
      refs[m.id] = { authorizationId: m.authorizationId, captureId: m.captureId };
      events.push(...m.events.map(toEventDTO));
    }
  }
  events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return { deals: rows.map(toDealDTO), events, refs };
}

export async function getShellSummary(): Promise<ShellSummary> {
  const deals = await prisma.deal.findMany({
    orderBy: { updatedAt: "desc" },
    include: { milestones: { select: { id: true, title: true, heldAmount: true, releasedAmount: true } } },
  });
  let held = 0;
  let captured = 0;
  const titles: Record<string, string> = {};
  for (const d of deals) {
    for (const m of d.milestones) {
      titles[m.id] = m.title;
      if (d.isDemo) continue;
      held += Number(m.heldAmount);
      captured += Number(m.releasedAmount);
    }
  }
  const events = await prisma.event.findMany({
    where: { milestoneId: { not: null }, type: { notIn: ["ORDER_CREATED", "WEBHOOK_RECEIVED", "PAYMENT_FAILED"] } },
    orderBy: { createdAt: "desc" },
    take: 4,
  });
  const latest = deals.find((d) => !d.isDemo) ?? deals[0] ?? null;
  return {
    held,
    captured,
    dealCount: deals.filter((d) => !d.isDemo).length,
    latestDeal: latest ? { id: latest.id, title: latest.title } : null,
    events: events.map(toEventDTO),
    titles,
  };
}

export async function getDealDetail(id: string): Promise<DealDetailDTO | null> {
  // The demo deal creates itself on first visit.
  if (id === DEMO_DEAL_ID) await ensureDemoDeal(prisma);
  const deal = await prisma.deal.findUnique({ where: { id }, include: DEAL_DETAIL_INCLUDE });
  return deal ? toDealDetailDTO(deal) : null;
}
