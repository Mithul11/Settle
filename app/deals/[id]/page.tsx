import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DealView, type MilestoneView } from "@/components/deal/deal-view";
import { prisma } from "@/lib/db";
import { DEMO_DEAL_ID, ensureDemoDeal } from "@/lib/demo-deal";

type Params = Promise<{ id: string }>;

export default function DealPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        &larr; Settle
      </Link>
      {/* Deal data is read per request, so it streams in behind Suspense. */}
      <Suspense
        fallback={<p className="mt-6 text-sm text-muted-foreground">Loading deal…</p>}
      >
        <Deal params={params} />
      </Suspense>
    </main>
  );
}

async function Deal({ params }: { params: Params }) {
  const { id } = await params;

  // The demo deal creates itself on first visit, so the payment loop can be
  // tested without running the seed script.
  if (id === DEMO_DEAL_ID) await ensureDemoDeal(prisma);

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: { milestones: { orderBy: { position: "asc" } } },
  });
  if (!deal) notFound();

  const milestones: MilestoneView[] = deal.milestones.map((m) => ({
    id: m.id,
    title: m.title,
    criteria: Array.isArray(m.criteria) ? m.criteria.map(String) : [],
    amount: m.amount.toFixed(2),
    status: m.status,
    capturedAmount: m.capturedAmount?.toFixed(2) ?? null,
  }));

  return (
    <>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{deal.title}</h1>
      <p className="mt-1 text-muted-foreground">{deal.brief}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Client: {deal.clientName} &middot; Freelancer: {deal.freelancerName}
      </p>

      <DealView
        milestones={milestones}
        // The PayPal client id is public by design (it is sent to the browser SDK).
        paypalClientId={process.env.PAYPAL_CLIENT_ID ?? ""}
      />
    </>
  );
}
