"use client";

import { Banknote, ScanSearch, Sparkles, Wallet } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Tile with a cursor spotlight (sets --mx/--my on mousemove). */
export function Spot({ tone = "em", base = "var(--bg)", className, children, ...rest }: { tone?: "em" | "blue"; base?: string; className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className={cn(tone === "em" ? "spot-em" : "spot-blue", className)}
      style={{ ["--spot-base" as string]: base }}
    >
      {children}
    </div>
  );
}

/** Background glows with a scroll parallax factor. */
export function Parallax({ factor, className }: { factor: number; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (ref.current) ref.current.style.transform = `translate3d(0,${window.scrollY * factor}px,0)`;
      });
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [factor]);
  return <div ref={ref} aria-hidden="true" className={cn("pointer-events-none absolute", className)} />;
}

const PREVIEW = [
  { n: "01", title: "Auth & onboarding flow", amount: "$1,200", label: "Released", cls: "text-em bg-em-soft" },
  { n: "02", title: "Invoice builder", amount: "$2,400", label: "In review", cls: "text-blue bg-blue-soft" },
  { n: "03", title: "PayPal payouts integration", amount: "$1,600", label: "Awaiting funding", cls: "text-muted-foreground bg-chip" },
];

const STEPS = [
  { label: "Fund", icon: Wallet, sub: "Client authorizes the milestone" },
  { label: "Verify", icon: ScanSearch, sub: "AI checks the criteria" },
  { label: "Release", icon: Banknote, sub: "Funds captured on approval" },
];

/** Product preview (illustration) that tilts toward the cursor, plus the Fund → Verify → Release step tiles. */
export function HeroPreview() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 3), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <div
        aria-label="Example deal preview"
        onMouseMove={(e) => {
          if (window.innerWidth < 900) return;
          const el = e.currentTarget, r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
          el.style.transform = `perspective(1200px) rotateY(${(x * 5).toFixed(2)}deg) rotateX(${(-y * 5).toFixed(2)}deg) translateY(-2px)`;
        }}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
        className="overflow-hidden rounded-2xl border border-line2 bg-surface shadow-card transition-transform duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)] will-change-transform"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-[18px] py-3.5">
          <span className="size-2 rounded-full bg-em" />
          <span className="font-semibold">Ledgerline invoicing app</span>
          <span className="ml-auto font-mono text-[12px] text-muted-foreground">LL-2041</span>
        </div>
        <div className="grid grid-cols-3 border-b border-line">
          {[
            ["Deal value", "$5,200", ""],
            ["Authorized", "$3,600", "text-blue"],
            ["Captured", "$1,200", "text-em"],
          ].map(([l, v, c], i) => (
            <div key={l} className={cn("flex flex-col gap-0.5 px-[18px] py-3.5", i > 0 && "border-l border-line")}>
              <span className="text-[12px] text-muted-foreground">{l}</span>
              <span className={cn("text-[20px] font-semibold tracking-[-0.02em]", c)}>{v}</span>
            </div>
          ))}
        </div>
        {PREVIEW.map((m) => (
          <div key={m.n} className="flex items-center gap-3 border-b border-line px-[18px] py-3">
            <span className="font-mono text-[12px] text-faint">{m.n}</span>
            <span className="min-w-0 flex-1 truncate">{m.title}</span>
            <span className="font-mono text-[13px]">{m.amount}</span>
            <span className={cn("rounded-md px-2 py-0.5 text-[12px] font-medium whitespace-nowrap", m.cls)}>{m.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2.5 px-[18px] py-3.5 text-[13px] text-muted-foreground">
          <Sparkles className="size-4 text-blue" />
          AI review: 4 of 6 criteria pass on Invoice builder
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {STEPS.map((s, i) => {
          const on = i === step, done = i < step;
          return (
            <div
              key={s.label}
              className={cn(
                "flex min-w-0 flex-col gap-1.5 rounded-xl border p-3 transition-all duration-400",
                on ? "border-em bg-em-soft" : "border-line bg-surface",
              )}
            >
              <span className={cn("flex items-center gap-2 font-semibold", on || done ? "text-em" : "text-muted-foreground")}>
                <s.icon className="size-4" />
                {s.label}
              </span>
              <span className="text-[12px] text-muted-foreground">{s.sub}</span>
              <span className="h-[3px] overflow-hidden rounded-sm bg-line">
                <span
                  className={cn("block h-full", on || done ? "bg-em" : "bg-muted-foreground")}
                  style={{ width: on || done ? "100%" : "0%", transition: on ? "width 1.6s linear" : "none" }}
                />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
