"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { TimelineTile } from "@/components/shell/icons";
import { cn } from "@/lib/utils";
import { fdt, PAY, TIMELINE, TONE, WORK, type PayStatus, type TimelineEntry, type Tone, type WorkStatus } from "@/lib/view";

export function Badge({ tone, children, dot, className }: { tone: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  const t = TONE[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium whitespace-nowrap", t.fg, t.bg, className)}>
      {dot && <span className={cn("size-1.5 rounded-full", t.dot)} />}
      {children}
    </span>
  );
}

export function WorkBadge({ status }: { status: WorkStatus }) {
  return <Badge tone={WORK[status].tone}>{WORK[status].label}</Badge>;
}

export function PayLabel({ status, note }: { status: PayStatus; note?: string }) {
  const t = TONE[PAY[status].tone];
  return (
    <span className="flex flex-col items-start gap-0.5">
      <span className={cn("flex items-center gap-1.5 text-[12.5px] font-medium whitespace-nowrap", t.fg)}>
        <span className={cn("size-1.5 rounded-full", t.dot)} />
        {PAY[status].label}
      </span>
      {note && <span className="font-mono text-[11px] text-muted-foreground">{note}</span>}
    </span>
  );
}

export function DemoTag() {
  return (
    <span className="rounded-[5px] border border-line2 px-1.5 font-mono text-[10.5px] tracking-[0.04em] text-faint uppercase">
      Demo
    </span>
  );
}

export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("rounded-xl border border-line bg-surface", className)} {...rest}>
      {children}
    </section>
  );
}

export function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={cn("shimmer block rounded", className)} style={style} />;
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn("size-4 animate-spin", className)} />;
}

// --- Confirmation dialog --------------------------------------------------
export type ConfirmSpec = {
  title: string;
  body: string;
  amount: string;
  cta: string;
  danger?: boolean;
  /** Extra content between the amount and the buttons (reason field, PayPal button). */
  extra?: ReactNode;
  /** Hide the confirm button (e.g. when the PayPal button is the action). */
  hideConfirm?: boolean;
  onConfirm?: () => Promise<void>;
};

/**
 * Financial confirmation: role="alertdialog", focus trap, Esc and click
 * outside close it unless a request is running.
 */
export function ConfirmDialog({ spec, onClose }: { spec: ConfirmSpec | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const titleId = useId();

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!spec) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>("button:not(:disabled),textarea,input,[href],[tabindex]:not([tabindex='-1'])") ?? [],
      );
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!busyRef.current) onClose();
      }
      if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        const first = f[0]!, last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [spec, onClose]);

  if (!spec) return null;

  async function run() {
    if (!spec?.onConfirm) return;
    setBusy(true);
    try {
      await spec.onConfirm();
      setBusy(false);
      onClose();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-[oklch(0.1_0.02_262/0.6)] p-4 backdrop-blur-[6px]"
      onClick={() => !busy && onClose()}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[440px] animate-fade-up flex-col gap-4 rounded-2xl border border-line2 bg-surface p-6 shadow-card"
      >
        <span id={titleId} className="text-[18px] font-semibold tracking-[-0.01em]">{spec.title}</span>
        <span className="text-[13.5px] text-pretty text-muted-foreground">{spec.body}</span>
        <div className="flex items-center justify-between rounded-[10px] border border-line bg-background px-4 py-3.5">
          <span className="text-[13px] text-muted-foreground">Amount</span>
          <span className="font-mono text-[18px] font-medium">{spec.amount}</span>
        </div>
        {spec.extra}
        <div className="flex flex-wrap-reverse justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn-line flex-[1_1_120px] bg-transparent">
            Cancel
          </button>
          {!spec.hideConfirm && (
            <button
              type="button"
              onClick={run}
              disabled={busy}
              className={cn("btn-em flex-[1_1_160px] rounded-[9px]", spec.danger && "bg-amber")}
            >
              {busy ? (
                <>
                  <Spinner />
                  Processing
                </>
              ) : (
                spec.cta
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Activity timeline ---------------------------------------------------
export function Timeline({ items, variant = "full", empty = "No events yet." }: { items: TimelineEntry[]; variant?: "full" | "compact"; empty?: string }) {
  if (!items.length) return <p className="p-4 text-center text-[13px] text-muted-foreground">{empty}</p>;
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {items.map((e, i) => {
        const tone = TONE[TIMELINE[e.type].tone];
        return (
          <li key={e.id} className="flex animate-fade-up gap-3.5">
            <div className="flex flex-none flex-col items-center">
              <TimelineTile type={e.type} size={variant === "full" ? 32 : 30} />
              {i < items.length - 1 && <span className="my-1 w-px flex-1 bg-line2" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px] pb-[18px]">
              {variant === "full" ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className={cn("font-mono text-[10.5px] leading-[1.4] font-medium tracking-[0.06em] whitespace-nowrap uppercase", tone.fg)}>
                      {TIMELINE[e.type].label}
                    </span>
                    <time className="ml-auto font-mono text-[11.5px] whitespace-nowrap text-muted-foreground">{fdt(e.at)}</time>
                  </div>
                  <span className="text-[13.5px] font-medium">{e.title}</span>
                  <span className="text-[12.5px] [overflow-wrap:anywhere] text-muted-foreground">{e.meta}</span>
                </>
              ) : (
                <>
                  <span className="text-[13px] font-medium">{e.title}</span>
                  <span className="text-[12px] text-muted-foreground">{e.meta}</span>
                  <span className="font-mono text-[11px] text-faint">{fdt(e.at)}</span>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// --- Score ring ----------------------------------------------------------
export function ScoreRing({ score, size = 152 }: { score: number; size?: number }) {
  const C = 2 * Math.PI * 52;
  const [shown, setShown] = useState(false);
  const gid = useId().replace(/:/g, "");
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 120);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--chip)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke={`url(#g${gid})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={C}
          style={{
            strokeDashoffset: shown ? C * (1 - score / 100) : C,
            transition: "stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)",
          }}
        />
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--blue)" />
            <stop offset="1" stopColor="var(--em)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[40px] leading-none font-semibold tracking-[-0.04em]">{score}</span>
        <span className="text-[12px] text-muted-foreground">out of 100</span>
      </div>
    </div>
  );
}
