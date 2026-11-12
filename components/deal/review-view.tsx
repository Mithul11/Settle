"use client";

import {
  ArrowLeft,
  CircleCheck,
  CircleHelp,
  CircleX,
  FileCode,
  ScanSearch,
  Sparkles,
  TriangleAlert,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, ScoreRing, Spinner } from "@/components/app/ui";
import { ActionButton, latestReviews, useMilestoneActions } from "@/components/deal/deal-view";
import { PageTitle } from "@/components/shell/page-title";
import { isReviewResult, type DealDetailDTO, type MilestoneDTO, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fdt, fmt, postJSON, TONE, type Tone } from "@/lib/view";

type Verdict = "PASS" | "FAIL" | "UNVERIFIABLE";
const VERDICT: Record<Verdict, { tone: Tone; icon: LucideIcon; label: string }> = {
  PASS: { tone: "em", icon: CircleCheck, label: "Pass" },
  FAIL: { tone: "red", icon: CircleX, label: "Fail" },
  UNVERIFIABLE: { tone: "amber", icon: CircleHelp, label: "Unverifiable" },
};

const CODE_EXT = /\.(tsx?|jsx?|mjs|py|go|rs|java|md|json|css|scss|html|sql|ya?ml|rb|php|cs|kt|swift|prisma|toml)$/i;

/** First file path in the Gemini evidence text, with a line range if it gives one. */
function fileRef(evidence: string): { file: string; lines: string } | null {
  const m = /((?:[\w@.-]+\/)*[\w@-]+\.[a-z]{1,6})(?:(?::|#L| L| lines? )(\d+)(?:\s*[-–]\s*L?(\d+))?)?/i.exec(evidence);
  if (!m || !CODE_EXT.test(m[1]!)) return null;
  return { file: m[1]!, lines: m[2] ? `L${m[2]}${m[3] ? `–${m[3]}` : ""}` : "" };
}

/** Milestone to show: ?m=, else the newest reviewed one, else one being reviewed. */
function pick(deal: DealDetailDTO, id: string | null, reviewed: Set<string>): MilestoneDTO | null {
  const ms = deal.milestones;
  return (
    ms.find((m) => m.id === id) ??
    [...ms].reverse().find((m) => reviewed.has(m.id)) ??
    ms.find((m) => m.status === "SUBMITTED") ??
    null
  );
}

export function ReviewView({ deal, role, milestoneId }: { deal: DealDetailDTO; role: Role; milestoneId: string | null }) {
  const router = useRouter();
  const reviews = useMemo(() => latestReviews(deal.reviews), [deal.reviews]);
  const m = pick(deal, milestoneId, new Set(Object.keys(reviews)));
  const review = m ? reviews[m.id] : undefined;
  const result = review && isReviewResult(review.result) ? review.result : null;
  const { dialog, closeDialog, approve, dispute } = useMilestoneActions(deal.id);
  const [shown, setShown] = useState(false);
  const [running, setRunning] = useState(false);
  const isClient = role === "CLIENT";
  const index = m ? deal.milestones.indexOf(m) + 1 : 0;

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 120);
    return () => clearTimeout(t);
  }, [review?.id]);

  async function runReview() {
    if (!m) return;
    setRunning(true);
    try {
      await postJSON(`/api/ai/review/${m.id}`);
      toast.success("AI review completed");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI review failed");
    } finally {
      setRunning(false);
    }
  }

  const title = <PageTitle title="AI review" sub={m ? `${m.title} · Milestone ${index}` : deal.title} />;

  if (!m || !result || !review) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-14 text-center">
        {title}
        <span className="grid size-11 place-items-center rounded-xl bg-blue-soft text-blue">
          <ScanSearch className="size-5" />
        </span>
        <span className="text-[16px] font-semibold">{m ? `No AI review for ${m.title} yet` : "No milestone has been submitted yet"}</span>
        <span className="max-w-[440px] text-[13.5px] text-muted-foreground">
          {m?.status === "SUBMITTED"
            ? "The work is submitted. Run the review to check it against the acceptance criteria."
            : "The review runs when the freelancer submits a GitHub repository."}
        </span>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {m?.status === "SUBMITTED" && (
            <button type="button" onClick={runReview} disabled={running} className="btn-em">
              {running ? <Spinner /> : <Sparkles className="size-4" />}
              {running ? "Gemini is reviewing" : "Run AI review"}
            </button>
          )}
          <ActionButton a={{ label: "Back to deal", icon: ArrowLeft, href: `/deals/${deal.id}` }} />
        </div>
      </div>
    );
  }

  const criteria = result.criteria.map((c) => {
    // The schema gives pass/fail; an explicit UNVERIFIABLE verdict is honoured if the reviewer adds one.
    const raw = (c as { verdict?: unknown }).verdict;
    const verdict: Verdict = raw === "UNVERIFIABLE" ? "UNVERIFIABLE" : c.pass ? "PASS" : "FAIL";
    return { ...c, verdict, ref: fileRef(c.evidence) };
  });
  const counts = (["PASS", "FAIL", "UNVERIFIABLE"] as Verdict[]).map((v) => ({ v, n: criteria.filter((c) => c.verdict === v).length }));
  const score = review.score ?? result.score;
  const failing = criteria.filter((c) => c.verdict !== "PASS").map((c) => c.name);
  const summary =
    `${counts[0]!.n} of ${criteria.length} criteria pass. Overall verdict: ${result.verdict === "PASS" ? "pass" : "fail"}.` +
    (failing.length ? ` Open items: ${failing.join("; ")}.` : "");
  const repo = (review.deliverableUrl ?? m.deliverableUrl ?? "").replace(/^https?:\/\/(www\.)?/, "");
  const canAct = isClient && m.status === "REVIEWED";
  const stale = m.deliverableUrl && review.deliverableUrl && m.deliverableUrl !== review.deliverableUrl;

  return (
    <div className="flex flex-wrap items-start gap-5">
      {title}
      <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 min-[900px]:sticky min-[900px]:top-[88px]">
        <div className="flex flex-col items-center gap-[18px] rounded-[14px] border border-line bg-surface p-6 text-center">
          <ScoreRing key={review.id} score={score} />
          <div className="flex flex-col gap-1">
            <span className="text-[16px] font-semibold">{m.title}</span>
            <span className="text-[12.5px] text-muted-foreground">Reviewed by Gemini</span>
            <span className="text-[12.5px] text-muted-foreground">{fdt(review.createdAt)}</span>
            {repo && <span className="font-mono text-[11.5px] break-all text-faint">{repo}</span>}
          </div>
          <div className="grid w-full grid-cols-3 gap-2">
            {counts.map(({ v, n }) => (
              <div key={v} className={cn("flex flex-col gap-0.5 rounded-[9px] px-1 py-2.5", TONE[VERDICT[v].tone].bg)}>
                <span className={cn("text-[20px] font-semibold", TONE[VERDICT[v].tone].fg)}>{n}</span>
                <span className="text-[11.5px] text-muted-foreground">{VERDICT[v].label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-5">
          <span className="flex items-center gap-2 font-semibold">
            <UserCheck className="size-4 text-em" />
            Human approval
          </span>
          <span className="text-[13px] text-muted-foreground">
            The AI only reports. Releasing {fmt(m.amount)} requires the client’s decision.
          </span>
          {(!canAct || m.isDemo) && (
            <span className="rounded-lg bg-chip px-3 py-2.5 text-[13px] text-muted-foreground">
              {m.isDemo && canAct
                ? "Demo milestone: PayPal capture is disabled."
                : !isClient && m.status === "REVIEWED"
                  ? "Waiting for the client to approve or dispute."
                  : `Milestone status: ${m.status.toLowerCase()}.`}
            </span>
          )}
          <div className="flex flex-col gap-2">
            {canAct && !m.isDemo && <ActionButton a={{ label: "Approve & release", icon: CircleCheck, run: () => approve(m) }} primary block />}
            {canAct && <ActionButton a={{ label: "Dispute", icon: TriangleAlert, run: () => dispute(m) }} block />}
            <ActionButton a={{ label: "Back to deal", icon: ArrowLeft, href: `/deals/${deal.id}` }} block />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-3">
        {stale && (
          <div className="flex gap-3 rounded-xl border border-amber bg-amber-soft px-5 py-3 text-[13px]">
            <TriangleAlert className="mt-[2px] size-4 flex-none text-amber" />
            This report is for an earlier submission. A new review runs on the latest one.
          </div>
        )}
        <div className="flex gap-3 rounded-xl border border-line bg-surface px-5 py-4 text-[13.5px] text-muted-foreground">
          <Sparkles className="mt-[3px] size-4 flex-none text-blue" />
          <span>{summary}</span>
        </div>
        {criteria.map((c, i) => {
          const v = VERDICT[c.verdict];
          const t = TONE[v.tone];
          return (
            <article
              key={`${review.id}-${i}`}
              className="overflow-hidden rounded-xl border border-line bg-surface transition-[opacity,transform] duration-[450ms] ease-out"
              style={{ opacity: shown ? 1 : 0, transform: shown ? "none" : "translateY(8px)", transitionDelay: `${300 + i * 110}ms` }}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-5 py-4">
                <span className={cn("grid size-[30px] flex-none place-items-center rounded-lg", t.fg, t.bg)}>
                  <v.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-[1_1_200px] font-medium">{c.name}</span>
                <span className={cn("rounded-[5px] px-2 py-[3px] font-mono text-[11px] font-semibold tracking-[0.04em]", t.fg, t.bg)}>{c.verdict}</span>
              </div>
              <div className="flex flex-col gap-2.5 pr-5 pb-4 pl-[62px] max-[520px]:pl-5">
                <span className="text-[13px] text-pretty text-muted-foreground">{c.evidence}</span>
                {c.ref && (
                  <span className="flex max-w-full items-center gap-2 self-start overflow-hidden rounded-[7px] border border-line bg-background px-2.5 py-1.5 font-mono text-[12px]">
                    <FileCode className="size-3.5 flex-none text-faint" />
                    <span className="truncate">{c.ref.file}</span>
                    {c.ref.lines && <span className="flex-none text-faint">{c.ref.lines}</span>}
                  </span>
                )}
              </div>
            </article>
          );
        })}
        <Link href={`/deals/${deal.id}`} className="self-start text-[13px]">
          Back to {deal.title}
        </Link>
      </div>
      <ConfirmDialog spec={dialog} onClose={closeDialog} />
    </div>
  );
}
