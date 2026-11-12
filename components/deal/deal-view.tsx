"use client";

import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import {
  CircleCheck,
  FolderGit2,
  Info,
  Receipt,
  Scale,
  ScanSearch,
  Send,
  TriangleAlert,
  Undo2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge, ConfirmDialog, DemoTag, Spinner, Timeline, type ConfirmSpec } from "@/components/app/ui";
import { PageTitle } from "@/components/shell/page-title";
import { isReviewResult, type DealDetailDTO, type MilestoneDTO, type ReviewDTO, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fday, fmt, GITHUB_REPO_RE, initials, ledgerTotals, postJSON, STAGE, toTimeline, TONE, type Tone } from "@/lib/view";

type Action = { label: string; icon: LucideIcon; run?: () => void; href?: string };

/** Latest AI review (kind REVIEW) per milestone. Reviews come oldest first. */
export function latestReviews(reviews: ReviewDTO[]): Record<string, ReviewDTO> {
  const out: Record<string, ReviewDTO> = {};
  for (const r of reviews) if (r.kind === "REVIEW") out[r.milestoneId] = r;
  return out;
}

export function reviewSummary(r: ReviewDTO | undefined): string | null {
  if (!r || !isReviewResult(r.result)) return null;
  const total = r.result.criteria.length;
  const pass = r.result.criteria.filter((c) => c.pass).length;
  return `${pass} of ${total} criteria pass`;
}

export function dealStatus(ms: MilestoneDTO[]): { label: string; tone: Tone } {
  if (ms.some((m) => m.status === "DISPUTED")) return { label: "Disputed", tone: "amber" };
  if (ms.some((m) => m.status === "REVIEWED" || m.status === "SUBMITTED")) return { label: "In review", tone: "blue" };
  if (ms.length && ms.every((m) => m.status === "RELEASED" || m.status === "SETTLED")) return { label: "Complete", tone: "em" };
  return { label: "Active", tone: "blue" };
}

export function dealRef(id: string) {
  return id.toUpperCase().slice(0, 10);
}

function SubmitForm({ milestone, onDone }: { milestone: MilestoneDTO; onDone: () => void }) {
  const [repo, setRepo] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = repo.trim();
    if (!GITHUB_REPO_RE.test(value)) {
      setErr("Enter a GitHub repository URL, e.g. github.com/you/project");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const url = value.startsWith("http") ? value : `https://${value}`;
      const res = await postJSON<{ status: string; reviewError?: string }>(`/api/milestones/${milestone.id}/submit`, {
        deliverableUrl: url,
        note: notes.trim() || undefined,
      });
      if (res.reviewError) toast.warning(`Submitted. AI review failed: ${res.reviewError}`);
      else toast.success(res.status === "REVIEWED" ? "Submitted. The AI review is ready." : "Submitted. AI review is running.");
      setRepo("");
      setNotes("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium">GitHub repository URL</span>
        <input
          value={repo}
          onChange={(e) => {
            setRepo(e.target.value);
            setErr("");
          }}
          placeholder="github.com/you/project"
          aria-invalid={!!err}
          className={cn("field font-mono text-[13px]", err && "border-red")}
        />
      </label>
      {err && <span className="text-[12px] text-red">{err}</span>}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Submission notes for the client and reviewer"
        aria-label="Submission notes"
        className="resize-y rounded-[9px] border border-line2 bg-background px-3 py-2.5 text-[13px] outline-none"
      />
      <button type="button" onClick={submit} disabled={busy} className="btn-em rounded-[9px]">
        {busy ? <Spinner /> : <Send className="size-4" />}
        Submit for review
      </button>
    </div>
  );
}

export function ActionButton({ a, primary, block }: { a: Action; primary?: boolean; block?: boolean }) {
  const cls = cn(
    primary
      ? "btn-em h-10 rounded-[9px] px-3.5"
      : "inline-flex h-10 items-center justify-center gap-2 rounded-[9px] border border-line2 bg-background px-3.5 font-medium text-foreground transition-colors hover:border-foreground hover:text-foreground",
    block && "h-11 w-full",
  );
  const icon = <a.icon className={cn("size-4", !primary && "text-muted-foreground")} />;
  if (a.href)
    return (
      <Link href={a.href} className={cls}>
        {icon}
        {a.label}
      </Link>
    );
  return (
    <button type="button" onClick={a.run} className={cls}>
      {icon}
      {a.label}
    </button>
  );
}

/** Dialog specs for the money and dispute actions, shared by deal and review pages. */
export function useMilestoneActions(dealId: string) {
  const router = useRouter();
  const [dialog, setDialog] = useState<ConfirmSpec | null>(null);
  const closeDialog = useCallback(() => setDialog(null), []);

  const approve = (m: MilestoneDTO) =>
    setDialog({
      title: "Approve and release?",
      body: "This captures the authorized funds and pays out to the freelancer. This cannot be undone.",
      amount: fmt(m.amount),
      cta: `Release ${fmt(m.amount)}`,
      onConfirm: async () => {
        try {
          await postJSON(`/api/milestones/${m.id}/approve`);
          toast.success(`Payment released for ${m.title}`);
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Capture failed");
          throw e;
        }
      },
    });

  const voidHold = (m: MilestoneDTO) =>
    setDialog({
      title: "Void this authorization?",
      body: "The hold is released back to the client’s PayPal account. The voided amount is never charged.",
      amount: fmt(m.heldAmount),
      cta: "Void authorization",
      danger: true,
      onConfirm: async () => {
        try {
          await postJSON(`/api/milestones/${m.id}/void`);
          toast.success("Authorization voided, hold released");
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Void failed");
          throw e;
        }
      },
    });

  const dispute = (m: MilestoneDTO) => {
    let reason = "";
    setDialog({
      title: "Open a dispute?",
      body: "Funds stay authorized while two AI advocates negotiate a settlement from the review evidence. Both parties must accept the result.",
      amount: fmt(m.amount),
      cta: "Open dispute",
      danger: true,
      extra: (
        <textarea
          rows={3}
          onChange={(e) => (reason = e.target.value)}
          placeholder="What is missing or wrong? The advocates use this as the dispute reason."
          aria-label="Dispute reason"
          className="resize-y rounded-[9px] border border-line2 bg-background px-3 py-2.5 text-[13px] outline-none"
        />
      ),
      onConfirm: async () => {
        try {
          await postJSON(`/api/milestones/${m.id}/dispute`, { reason: reason.trim() || undefined });
          toast.success(`Dispute opened on ${m.title}`);
          router.push(`/deals/${dealId}/dispute?m=${m.id}`);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not open the dispute");
          throw e;
        }
      },
    });
  };

  return { dialog, setDialog, closeDialog, approve, voidHold, dispute };
}

export function DealView({ deal, role, paypalClientId }: { deal: DealDetailDTO; role: Role; paypalClientId: string }) {
  const router = useRouter();
  const { dialog, setDialog, closeDialog, approve, voidHold, dispute } = useMilestoneActions(deal.id);
  const isClient = role === "CLIENT";
  const ms = deal.milestones;
  const totals = ledgerTotals(ms);
  const status = dealStatus(ms);
  const reviews = useMemo(() => latestReviews(deal.reviews), [deal.reviews]);
  const titleOf = useCallback((id: string | null) => ms.find((m) => m.id === id)?.title ?? "", [ms]);
  const activity = useMemo(() => deal.events.map((e) => toTimeline(e, titleOf)).filter((x) => x !== null), [deal.events, titleOf]);
  const submittedAt = useMemo(() => {
    const out: Record<string, string> = {};
    for (const e of deal.events) if (e.type === "SUBMITTED" && e.milestoneId && !out[e.milestoneId]) out[e.milestoneId] = e.createdAt;
    return out;
  }, [deal.events]);

  const refresh = () => router.refresh();
  const base = `/deals/${deal.id}`;

  function fund(m: MilestoneDTO) {
    setDialog({
      title: `Fund ${m.title}?`,
      body: "PayPal will authorize this amount on your account. Nothing is captured until you approve the delivered work.",
      amount: fmt(m.amount),
      cta: `Authorize ${fmt(m.amount)}`,
      hideConfirm: true,
      extra: paypalClientId ? (
        <div className="flex flex-col gap-3">
        <p className="rounded-lg border border-amber/40 bg-amber-soft px-3 py-2.5 text-[12.5px] text-foreground">
          <span className="font-semibold text-amber">PayPal Sandbox.</span> Log in with a sandbox <b>Personal</b> account
          (Developer Dashboard → Testing Tools → Sandbox Accounts). No real money moves.
        </p>
        <PayPalButtons
          style={{ layout: "horizontal", tagline: false, height: 44 }}
          forceReRender={[m.id, m.amount]}
          createOrder={async () => {
            const { orderId } = await postJSON<{ orderId: string }>("/api/paypal/orders", { milestoneId: m.id });
            return orderId;
          }}
          onApprove={async (data) => {
            await postJSON(`/api/paypal/orders/${data.orderID}/authorize`);
            setDialog(null);
            toast.success(`${fmt(m.amount)} authorized for ${m.title}`);
            refresh();
          }}
          onError={(error) => {
            toast.error(error instanceof Error ? error.message : "PayPal error");
          }}
        />
        </div>
      ) : (
        <p className="rounded-lg bg-chip px-3 py-2.5 text-[13px] text-muted-foreground">
          PayPal is not configured. Set PAYPAL_CLIENT_ID in .env to show the PayPal button.
        </p>
      ),
    });
  }

  const content = (
    <div className="flex flex-col gap-5">
      <PageTitle title={deal.title} sub={`${dealRef(deal.id)} · ${deal.clientName}`} />

      <section className="flex flex-col gap-5 rounded-[14px] border border-line bg-surface p-6">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] text-faint">{dealRef(deal.id)}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
            {deal.isDemo && <DemoTag />}
          </span>
          <h1 className="m-0 text-[clamp(22px,3vw,28px)] font-semibold tracking-[-0.025em]">{deal.title}</h1>
          <p className="m-0 max-w-[760px] text-[13.5px] text-muted-foreground">{deal.brief}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full bg-blue-soft text-[10px] font-semibold text-blue">{initials(deal.clientName)}</span>
              {deal.clientName} · Client
            </span>
            <span className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full bg-em-soft text-[10px] font-semibold text-em">{initials(deal.freelancerName)}</span>
              {deal.freelancerName} · Freelancer
            </span>
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-px overflow-hidden rounded-[10px] border border-line bg-line">
          {[
            ["Total deal value", fmt(totals.total), ""],
            ["Authorized", fmt(totals.auth), "text-blue"],
            ["Captured", fmt(totals.captured), "text-em"],
          ].map(([l, v, c]) => (
            <div key={l} className="flex flex-col gap-0.5 bg-surface px-4 py-3.5">
              <span className="text-[12px] text-muted-foreground">{l}</span>
              <span className={cn("text-[22px] font-semibold tracking-[-0.02em] tabular-nums", c)}>{v}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <div className="relative h-2 overflow-hidden rounded bg-chip">
            <span
              className="absolute inset-y-0 left-0 border-r-2 border-blue bg-blue-soft transition-[width] duration-500"
              style={{ width: totals.total ? `${(totals.auth / totals.total) * 100}%` : 0 }}
            />
            <span
              className="absolute inset-y-0 left-0 bg-em transition-[width] duration-500"
              style={{ width: totals.total ? `${(totals.captured / totals.total) * 100}%` : 0 }}
            />
          </div>
          <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-em" />Captured</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-blue" />Authorized, held</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm border border-line2 bg-chip" />Not funded</span>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-3">
          {ms.map((m, i) => {
            const st = STAGE[m.status];
            const t = TONE[st.tone];
            const review = reviews[m.id];
            const summary = reviewSummary(review);
            const primary: Action[] = [];
            const secondary: Action[] = [];
            let note = "";
            let showSubmit = false;
            const money = !m.isDemo;
            if (isClient) {
              if ((m.status === "DRAFT" || m.status === "VOIDED") && money) primary.push({ label: "Fund milestone", icon: Wallet, run: () => fund(m) });
              if (m.status === "REVIEWED") {
                if (money) primary.push({ label: "Approve & release", icon: CircleCheck, run: () => approve(m) });
                secondary.push({ label: "Read AI review", icon: ScanSearch, href: `${base}/review?m=${m.id}` });
                secondary.push({ label: "Dispute", icon: TriangleAlert, run: () => dispute(m) });
              }
              if (["FUNDED", "SUBMITTED", "REVIEWED"].includes(m.status) && money)
                secondary.push({ label: "Void hold", icon: Undo2, run: () => voidHold(m) });
              if (m.status === "DISPUTED") primary.push({ label: "Open mediation", icon: Scale, href: `${base}/dispute?m=${m.id}` });
              if (m.status === "RELEASED" || m.status === "SETTLED")
                secondary.push({ label: "View receipt", icon: Receipt, run: () => toast(`${fmt(m.releasedAmount)} captured via PayPal for ${m.title}`) });
              if (m.status === "FUNDED") note = `Funds authorized. Waiting for ${deal.freelancerName} to submit work.`;
              if (m.status === "SUBMITTED") note = "AI review in progress. You will be notified when the report is ready.";
              if (m.status === "SETTLED") note = `Settled: ${fmt(m.releasedAmount)} captured, ${fmt(m.refundedAmount)} released back to you.`;
              if (m.status === "VOIDED") note = "Authorization voided. Nothing was charged.";
            } else {
              if (m.status === "DRAFT") note = `Waiting for ${deal.clientName} to fund this milestone. Do not start work until funds are authorized.`;
              if (m.status === "FUNDED") {
                showSubmit = true;
                note = `Funds authorized: ${fmt(m.heldAmount)} is held for you.`;
              }
              if (m.status === "REVIEWED") {
                secondary.push({ label: "View review report", icon: ScanSearch, href: `${base}/review?m=${m.id}` });
                note = "Waiting for the client to approve. You can resubmit an improved version below.";
                showSubmit = true;
              }
              if (m.status === "DISPUTED") primary.push({ label: "Open mediation", icon: Scale, href: `${base}/dispute?m=${m.id}` });
              if (m.status === "SUBMITTED") note = "Submitted. AI review is running against the acceptance criteria.";
              if (m.status === "RELEASED") note = `Paid out · ${fmt(m.releasedAmount)} captured to your PayPal.`;
              if (m.status === "SETTLED") note = `Settled: ${fmt(m.releasedAmount)} paid out to your PayPal.`;
              if (m.status === "VOIDED") note = "The client voided the authorization. No payment.";
            }
            if (m.isDemo) showSubmit = false;
            if (m.isDemo && !note) note = "Demo milestone: PayPal actions are disabled.";

            return (
              <article
                key={m.id}
                data-reveal={Math.min(i, 3)}
                className="overflow-hidden rounded-xl border border-line bg-surface transition-[border-color,box-shadow] hover:border-line2 hover:shadow-card"
              >
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 px-5 py-[18px]">
                  <span className="font-mono text-[12px] text-faint">M{i + 1}</span>
                  <span className="min-w-0 flex-[1_1_180px] text-[15px] font-semibold">{m.title}</span>
                  {m.isDemo && <DemoTag />}
                  <Badge tone={st.tone} dot>{st.label}</Badge>
                  <span className="font-mono text-[15px] font-medium">{fmt(m.amount)}</span>
                </div>
                <div className="h-[3px] bg-chip">
                  <span className={cn("block h-full transition-[width] duration-500", t.dot)} style={{ width: `${st.progress}%` }} />
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4 px-5 py-4">
                  <div className="flex min-w-0 flex-col gap-2">
                    <span className="text-[12px] font-medium text-muted-foreground">Acceptance criteria</span>
                    {m.criteria.map((c, n) => (
                      <span key={n} className="flex gap-2 text-[13px]">
                        <span className="mt-0.5 font-mono text-[11px] text-faint">{n + 1}</span>
                        {c}
                      </span>
                    ))}
                  </div>
                  <div className="flex min-w-0 flex-col gap-2.5">
                    {m.deliverableUrl && (
                      <div className="flex flex-col gap-1 rounded-[9px] border border-line bg-background p-3 text-[13px]">
                        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                          <FolderGit2 className="size-3.5" />
                          Submission{submittedAt[m.id] ? ` · ${fday(submittedAt[m.id]!)}` : ""}
                        </span>
                        <a href={m.deliverableUrl} target="_blank" rel="noreferrer" className="font-mono text-[12.5px] break-all">
                          {m.deliverableUrl.replace(/^https?:\/\//, "")}
                        </a>
                        {m.deliverableNote && <span className="text-muted-foreground">{m.deliverableNote}</span>}
                      </div>
                    )}
                    {review && review.score !== null && (
                      <Link
                        href={`${base}/review?m=${m.id}`}
                        className="flex items-center gap-3 rounded-[9px] border border-line bg-background p-3 text-[13px] text-foreground hover:border-line2 hover:text-foreground"
                      >
                        <span className="grid size-10 flex-none place-items-center rounded-full border-[3px] border-blue text-[13px] font-semibold">{review.score}</span>
                        <span className="flex flex-col leading-[1.35]">
                          <span className="font-medium">AI review</span>
                          <span className="text-[12.5px] text-muted-foreground">{summary}</span>
                        </span>
                      </Link>
                    )}
                    {note && (
                      <span className="flex gap-2 text-[13px] text-muted-foreground">
                        <Info className="mt-[3px] size-3.5 flex-none text-faint" />
                        {note}
                      </span>
                    )}
                    {showSubmit && <SubmitForm milestone={m} onDone={refresh} />}
                  </div>
                </div>
                {(primary.length > 0 || secondary.length > 0) && (
                  <div className="flex flex-wrap gap-2 px-5 pb-[18px]">
                    {primary.map((a) => <ActionButton key={a.label} a={a} primary />)}
                    {secondary.map((a) => <ActionButton key={a.label} a={a} />)}
                  </div>
                )}
              </article>
            );
          })}
          {ms.length === 0 && <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted-foreground">This deal has no milestones.</p>}
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Activity</span>
            <span className="ml-auto flex items-center gap-1.5 text-[12px] text-em">
              <span className="size-1.5 animate-soft-pulse rounded-full bg-em" />
              Live
            </span>
          </div>
          <Timeline items={activity} variant="compact" empty="No activity on this deal yet." />
        </aside>
      </div>
      <ConfirmDialog spec={dialog} onClose={closeDialog} />
    </div>
  );

  return paypalClientId ? (
    <PayPalScriptProvider options={{ clientId: paypalClientId, intent: "authorize", currency: "USD" }}>{content}</PayPalScriptProvider>
  ) : (
    content
  );
}
