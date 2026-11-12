"use client";

import { ArrowLeft, ArrowUpRight, Bot, Building2, CircleCheck, CodeXml, LoaderCircle, Paperclip, RotateCcw, Scale, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/app/ui";
import { ActionButton, latestReviews, reviewSummary } from "@/components/deal/deal-view";
import { PageTitle } from "@/components/shell/page-title";
import {
  isMediationTurn,
  type AcceptSettlementResponse,
  type DealDetailDTO,
  type MediationTurnResult,
  type Role,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmt, num, payloadOf, postJSON } from "@/lib/view";

/** A turn as stored, plus optional fields a mediator may include. */
type Turn = MediationTurnResult & { percent?: number; ref?: string };
type Round = { n: number; f?: Turn; c?: Turn };

function AdvocateCard({ side, turn }: { side: "f" | "c"; turn?: Turn }) {
  const em = side === "f";
  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border border-line border-t-2 bg-surface px-4 py-3.5", em ? "border-t-em" : "border-t-blue")}>
      <span className="flex items-center gap-2 text-[12.5px] font-semibold">
        <span className={cn("grid size-6 place-items-center rounded-[7px]", em ? "bg-em-soft text-em" : "bg-blue-soft text-blue")}>
          <Bot className="size-3.5" />
        </span>
        <span className="whitespace-nowrap">{em ? "Freelancer Advocate" : "Client Advocate"}</span>
        {typeof turn?.percent === "number" && (
          <span className={cn("ml-auto font-mono", em ? "text-em" : "text-blue")}>{turn.percent}%</span>
        )}
      </span>
      <span className="text-[13.5px] text-pretty text-muted-foreground">{turn?.message ?? "No statement this round."}</span>
      {turn?.ref && (
        <span className="flex max-w-full items-center gap-1.5 self-start truncate rounded-md bg-chip px-2 py-[3px] font-mono text-[11.5px] text-muted-foreground">
          <Paperclip className="size-3" />
          {turn.ref}
        </span>
      )}
    </div>
  );
}

export function DisputeView({ deal, role, milestoneId }: { deal: DealDetailDTO; role: Role; milestoneId: string | null }) {
  const router = useRouter();
  const isClient = role === "CLIENT";
  const ms = deal.milestones;
  const m =
    ms.find((x) => x.id === milestoneId) ??
    ms.find((x) => x.status === "DISPUTED") ??
    ms.find((x) => deal.mediations.some((md) => md.milestoneId === x.id)) ??
    null;
  const mediation = m ? deal.mediations.find((md) => md.milestoneId === m.id) ?? null : null;
  const review = m ? latestReviews(deal.reviews)[m.id] : undefined;
  const reason = useMemo(() => {
    const e = m ? deal.events.find((ev) => ev.type === "DISPUTED" && ev.milestoneId === m.id) : undefined;
    const r = e ? payloadOf(e.payload).reason : undefined;
    return typeof r === "string" && r ? r : null;
  }, [deal.events, m]);

  const rounds: Round[] = useMemo(() => {
    if (!m) return [];
    const turns = deal.reviews
      .filter((r) => r.kind === "MEDIATION" && r.milestoneId === m.id && isMediationTurn(r.result))
      .map((r) => r.result as Turn);
    const by = new Map<number, Round>();
    turns.forEach((t, i) => {
      const n = typeof t.round === "number" ? t.round : Math.floor(i / 2) + 1;
      const rd = by.get(n) ?? { n };
      if (t.speaker === "FREELANCER_MEDIATOR") rd.f = t;
      else rd.c = t;
      by.set(n, rd);
    });
    return [...by.values()].sort((a, b) => a.n - b.n);
  }, [deal.reviews, m]);

  const pct = mediation?.proposedReleasePercent ?? null;
  const [round, setRound] = useState(0);
  const [playKey, setPlayKey] = useState(0);
  const [running, setRunning] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const playing = round <= rounds.length && rounds.length > 0 && round < rounds.length + 1;

  useEffect(() => {
    if (!rounds.length) return;
    let n = 0;
    const t = setInterval(() => {
      n++;
      setRound(n);
      if (n >= rounds.length + 1) clearInterval(t);
    }, 1700);
    return () => clearInterval(t);
  }, [rounds.length, playKey]);

  if (!m) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-14 text-center">
        <PageTitle title="Dispute mediation" sub={deal.title} />
        <span className="grid size-11 place-items-center rounded-xl bg-em-soft text-em">
          <Scale className="size-5" />
        </span>
        <span className="text-[16px] font-semibold">No disputes on this deal</span>
        <span className="max-w-[440px] text-[13.5px] text-muted-foreground">
          A client can dispute a reviewed milestone. Two AI advocates then negotiate a split from the review evidence.
        </span>
        <ActionButton a={{ label: "Back to deal", icon: ArrowLeft, href: `/deals/${deal.id}` }} />
      </div>
    );
  }

  const showFinal = pct !== null && (rounds.length === 0 || round > rounds.length);
  const base = num(m.heldAmount) || num(m.amount);
  const settled = mediation?.status === "SETTLED" || m.status === "SETTLED";
  const capAmount = settled ? num(m.releasedAmount) : pct !== null ? (base * pct) / 100 : 0;
  const backAmount = settled ? num(m.refundedAmount) : pct !== null ? base - capAmount : 0;
  const st = mediation?.status ?? "OPEN";
  const clientAccepted = ["ACCEPTED_BY_CLIENT", "ACCEPTED_BY_BOTH", "SETTLED"].includes(st);
  const freelancerAccepted = ["ACCEPTED_BY_FREELANCER", "ACCEPTED_BY_BOTH", "SETTLED"].includes(st);
  const both = clientAccepted && freelancerAccepted;
  const canAccept = showFinal && !settled && (isClient ? !clientAccepted : !freelancerAccepted);

  async function runMediation() {
    setRunning(true);
    try {
      await postJSON(`/api/ai/mediate/${m!.id}`);
      toast.success("The advocates proposed a settlement");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mediation failed");
    } finally {
      setRunning(false);
    }
  }

  async function accept() {
    setAccepting(true);
    try {
      const res = await postJSON<AcceptSettlementResponse>(`/api/milestones/${m!.id}/settlement/accept`, { role });
      if (res.settled) toast.success(`Settlement executed: ${fmt(res.releasedAmount)} captured, ${fmt(res.refundedAmount)} released`);
      else if (res.pendingReason) toast(`Both parties accepted. ${res.pendingReason}`);
      else toast(`${isClient ? "Client" : "Freelancer"} accepted the settlement`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not accept the settlement");
    } finally {
      setAccepting(false);
    }
  }

  const statusTxt = !rounds.length
    ? pct !== null
      ? "Proposal ready"
      : "Negotiation not started"
    : showFinal
      ? "Proposal ready"
      : playing
        ? `Round ${Math.max(1, round)} of ${rounds.length} in progress`
        : "Negotiation paused";

  const btn = (who: "client" | "freelancer") => {
    const mine = (who === "client") === isClient;
    const done = who === "client" ? clientAccepted : freelancerAccepted;
    const active = mine && canAccept;
    const label = done
      ? `${who === "client" ? "Client" : "Freelancer"} accepted`
      : mine
        ? `Accept as ${who}`
        : `Waiting for ${who}`;
    const Icon = who === "client" ? Building2 : CodeXml;
    return (
      <button
        type="button"
        onClick={active ? accept : undefined}
        disabled={!active || accepting}
        className={cn(
          "flex h-[52px] items-center justify-center gap-2 rounded-[10px] border border-line2 font-semibold transition-all",
          done ? "bg-em-soft text-em" : active ? "bg-em text-on-em" : "bg-chip text-muted-foreground",
          !active && "cursor-not-allowed",
        )}
      >
        {active && accepting ? <Spinner /> : <Icon className="size-4" />}
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title="Dispute mediation" sub={`${m.title} · Milestone ${ms.indexOf(m) + 1}`} />

      <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-px overflow-hidden rounded-[14px] border border-line bg-line">
        <div className="flex flex-col gap-1.5 bg-surface px-5 py-[18px]">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-amber">
            <TriangleAlert className="size-3.5" />
            Dispute reason · raised by client
          </span>
          <span className="text-[14px]">{reason ?? "No reason was given."}</span>
        </div>
        <div className="flex flex-col gap-1.5 bg-surface px-5 py-[18px]">
          <span className="text-[12px] text-muted-foreground">Original milestone amount</span>
          <span className="text-[24px] font-semibold tracking-[-0.02em]">{fmt(m.amount)}</span>
          <span className="text-[12px] text-faint">
            {num(m.heldAmount) > 0 ? "Authorized, held via PayPal" : settled ? "Settled via PayPal" : "No open authorization"}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 bg-surface px-5 py-[18px]">
          <span className="text-[12px] text-muted-foreground">AI review summary</span>
          <span className="text-[14px]">{review ? `Score ${review.score ?? "–"} · ${reviewSummary(review)}` : "No review on record"}</span>
          {review && (
            <Link href={`/deals/${deal.id}/review?m=${m.id}`} className="flex items-center gap-1 self-start text-[13px] text-blue">
              Open report
              <ArrowUpRight className="size-3.5" />
            </Link>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
          {playing && !showFinal && <span className="size-2 animate-soft-pulse rounded-full bg-blue" />}
          {statusTxt}
        </span>
        {rounds.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setRound(0);
              setPlayKey((k) => k + 1);
            }}
            className="ml-auto flex h-9 flex-none items-center gap-1.5 rounded-lg border border-line2 bg-surface px-3 text-[13px] font-medium whitespace-nowrap"
          >
            <RotateCcw className="size-3.5" />
            Replay negotiation
          </button>
        )}
      </div>

      <section className="flex flex-col">
        {rounds.slice(0, Math.min(round, rounds.length)).map((rd) => {
          const fp = rd.f?.percent, cp = rd.c?.percent;
          const track = typeof fp === "number" && typeof cp === "number";
          return (
            <div key={rd.n} className="flex animate-fade-up gap-4">
              <div className="flex flex-none flex-col items-center">
                <span className="grid size-9 place-items-center rounded-full border border-line2 bg-surface font-mono text-[11px] whitespace-nowrap">R{rd.n}</span>
                <span className="my-1 w-px flex-1 bg-line2" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2.5 pb-6">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-2.5">
                  <AdvocateCard side="f" turn={rd.f} />
                  <AdvocateCard side="c" turn={rd.c} />
                </div>
                {track && (
                  <div className="flex items-center gap-3">
                    <div className="relative h-1.5 flex-1 rounded-[3px] bg-chip">
                      <span
                        className="absolute inset-y-0 rounded-[3px] bg-gradient-to-r from-blue to-em opacity-50"
                        style={{ left: `${Math.min(cp, fp)}%`, right: `${100 - Math.max(cp, fp)}%` }}
                      />
                      <span className="absolute -top-[3px] -ml-1.5 size-3 rounded-full border-2 border-background bg-blue" style={{ left: `${cp}%` }} />
                      <span className="absolute -top-[3px] -ml-1.5 size-3 rounded-full border-2 border-background bg-em" style={{ left: `${fp}%` }} />
                    </div>
                    <span className="font-mono text-[12px] whitespace-nowrap text-faint">{Math.abs(fp - cp)} pt gap</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {rounds.length > 0 && round <= rounds.length && (
          <div className="flex items-center gap-4 pb-4">
            <span className="grid size-9 flex-none place-items-center rounded-full border border-dashed border-line2">
              <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
            </span>
            <span className="text-[13px] text-muted-foreground">Advocates are reviewing the evidence</span>
          </div>
        )}
        {rounds.length === 0 && pct === null && (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line2 p-5">
            <span className="text-[13.5px] text-muted-foreground">
              The Freelancer Advocate and the Client Advocate have not negotiated yet. They argue from the review evidence over 1 to 2 rounds and propose a split. No money moves.
            </span>
            <button type="button" onClick={runMediation} disabled={running || !mediation} className="btn-em">
              {running ? <Spinner /> : <Sparkles className="size-4" />}
              {running ? "Advocates are negotiating" : "Start mediation"}
            </button>
            {!mediation && <span className="text-[12px] text-faint">This milestone has no open mediation.</span>}
          </div>
        )}
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-line2 bg-surface shadow-card">
        <div className="pointer-events-none absolute -top-40 -right-[120px] size-[420px] bg-[radial-gradient(closest-side,var(--emSoft),transparent)]" />
        <div className="relative flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
              <span className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
                <Scale className="size-3.5 text-em" />
                Proposed settlement
              </span>
              {showFinal ? (
                <span className="animate-fade-up text-[clamp(40px,6vw,56px)] leading-none font-semibold tracking-[-0.045em]">
                  {pct}%<span className="text-[18px] font-medium tracking-[-0.01em] text-muted-foreground"> to freelancer</span>
                </span>
              ) : (
                <span className="text-[18px] text-faint">Waiting for the advocates to converge</span>
              )}
            </div>
            {settled && (
              <span className="flex items-center gap-2 rounded-lg bg-em-soft px-3 py-1.5 font-semibold text-em">
                <CircleCheck className="size-4" />
                Settlement executed
              </span>
            )}
            {!settled && both && (
              <span className="flex items-center gap-2 rounded-lg bg-blue-soft px-3 py-1.5 text-[13px] font-semibold text-blue">
                Both accepted · settlement capture disabled
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex h-11 gap-[3px] overflow-hidden rounded-[10px]">
              <div
                className="flex items-center overflow-hidden bg-em px-3.5 text-[13px] font-semibold whitespace-nowrap text-on-em transition-[width] duration-1000 ease-[cubic-bezier(.2,.8,.2,1)]"
                style={{ width: showFinal ? `${pct}%` : "50%" }}
              >
                {showFinal ? fmt(capAmount) : ""}
              </div>
              <div className="flex flex-1 items-center justify-end overflow-hidden rounded-r-[10px] border border-blue bg-blue-soft px-3.5 text-[13px] font-semibold whitespace-nowrap text-blue">
                {showFinal ? fmt(backAmount) : ""}
              </div>
            </div>
            <div className="flex justify-between gap-3 text-[12.5px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-em" />Captured and paid to {deal.freelancerName}</span>
              <span className="flex items-center gap-1.5 text-right">Released back to {deal.clientName}<span className="size-2 rounded-sm bg-blue" /></span>
            </div>
          </div>
          {showFinal && mediation?.rationale && (
            <div className="flex animate-fade-up gap-3 rounded-[10px] border border-line bg-background p-4">
              <Sparkles className="mt-[3px] size-4 flex-none text-blue" />
              <span className="text-[13.5px] text-pretty text-muted-foreground">{mediation.rationale}</span>
            </div>
          )}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-2.5">
            {btn("freelancer")}
            {btn("client")}
          </div>
          <span className="text-center text-[12px] text-faint">
            Both parties must accept. Use the role switcher in the top bar to accept as the other party.
          </span>
        </div>
      </section>
    </div>
  );
}
