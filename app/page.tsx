import {
  ArrowRight,
  Banknote,
  Bot,
  Building2,
  Check,
  CircleCheck,
  CircleHelp,
  CircleX,
  CodeXml,
  Lock,
  Play,
  ScanSearch,
  Sparkles,
  UserCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { HeroPreview, Parallax, Spot } from "@/components/landing/interactive";
import { LandingHeader } from "@/components/landing/landing-header";
import { Milestone3D } from "@/components/landing/milestone-3d";
import { DEMO_DEAL_ID } from "@/lib/demo-deal";
import { cn } from "@/lib/utils";

const CTA_EM =
  "flex h-12 flex-none items-center gap-2 rounded-[10px] bg-em px-[22px] text-[15px] font-semibold whitespace-nowrap text-on-em transition-[transform,box-shadow,filter] duration-200 hover:-translate-y-px hover:text-on-em hover:brightness-[1.06] hover:shadow-[0_10px_28px_-10px_var(--em)]";
const CTA_LINE =
  "flex h-12 flex-none items-center gap-2 rounded-[10px] border border-line2 bg-surface px-[22px] text-[15px] font-medium whitespace-nowrap text-foreground transition-colors hover:border-foreground hover:bg-surface2 hover:text-foreground";

const CRITERIA = [
  ["PASS", "Line items can be added, edited and removed"],
  ["PASS", "Tax and discount totals calculate correctly"],
  ["PASS", "Invoices export to PDF"],
  ["FAIL", "Invoices persist across sessions"],
  ["UNVERIFIABLE", "Matches approved Figma design"],
  ["PASS", "Responsive down to 375px"],
] as const;
const VERDICT = {
  PASS: { icon: CircleCheck, cls: "text-em", chip: "text-em bg-em-soft" },
  FAIL: { icon: CircleX, cls: "text-red", chip: "text-red bg-red-soft" },
  UNVERIFIABLE: { icon: CircleHelp, cls: "text-amber", chip: "text-amber bg-amber-soft" },
};

const HOW: [string, LucideIcon, string, string, string][] = [
  ["01", Wallet, "text-em", "Fund", "The client authorizes the milestone amount through PayPal. The freelancer sees the funds are held before writing a line of code."],
  ["02", ScanSearch, "text-blue", "Verify", "The freelancer submits a GitHub repository. Gemini reviews the code against each acceptance criterion and cites the files it checked."],
  ["03", Banknote, "text-em", "Release", "The client reads the report and approves. Funds are captured and paid out. If they disagree, mediation starts instead."],
];

const FLOW = [
  ["AUTHORIZE", "text-blue", "Funds reserved", "The client’s PayPal holds the milestone amount. No money moves yet."],
  ["REVIEW", "text-blue", "Work checked", "The authorization stays open while the AI review runs and the client decides."],
  ["CAPTURE", "text-em", "Full or partial", "Approval captures the full amount. A settlement captures the agreed share."],
  ["PAYOUT", "text-em", "Remainder returned", "Anything not captured is released back to the client automatically."],
] as const;

const BENEFITS = [
  { icon: CodeXml, tone: "em" as const, title: "For freelancers", items: ["Start work knowing the money is already authorized", "Objective review against criteria you agreed up front", "Partial payment instead of nothing when there is a disagreement"] },
  { icon: Building2, tone: "blue" as const, title: "For clients", items: ["Pay only for work that meets the acceptance criteria", "A readable code review even if you are not technical", "Uncaptured funds return to you automatically"] },
];

function Eyebrow({ tone = "em", children }: { tone?: "em" | "blue" | "amber"; children: React.ReactNode }) {
  return <span className={cn("eyebrow", tone === "em" ? "text-em" : tone === "blue" ? "text-blue" : "text-amber")}>{children}</span>;
}

const H2 = "m-0 text-[clamp(28px,4vw,40px)] leading-[1.1] font-semibold tracking-[-0.03em] text-balance";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />

      {/* Hero, split variant */}
      <section className="relative overflow-hidden border-b border-line">
        <Parallax factor={0.25} className="top-[-20%] right-[-10%] size-[720px] bg-[radial-gradient(closest-side,var(--blueSoft),transparent)]" />
        <Parallax factor={-0.12} className="bottom-[-30%] left-[-10%] size-[640px] bg-[radial-gradient(closest-side,var(--emSoft),transparent)]" />
        <div className="relative mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-center gap-14 px-5 pt-[72px] pb-20">
          <div className="flex min-w-0 flex-col gap-6">
            <span className="inline-flex w-fit max-w-full items-center gap-2 self-start rounded-full border border-line2 py-[5px] pr-3 pl-1.5 text-[12.5px] text-muted-foreground">
              <span className="flex-none rounded-full bg-em-soft px-2 py-0.5 font-semibold text-em">New</span>
              <span className="whitespace-nowrap">AI mediation for milestone disputes</span>
            </span>
            <h1 className="m-0 text-[clamp(40px,6vw,68px)] leading-[1.02] font-semibold tracking-[-0.04em] text-balance">
              Work Delivered.
              <br />
              <span className="bg-gradient-to-r from-em to-blue bg-clip-text text-transparent">Payments Protected.</span>
            </h1>
            <p className="m-0 max-w-[520px] text-[18px] text-pretty text-muted-foreground">
              Settle holds client funds per milestone, verifies delivered work against agreed acceptance criteria with AI, and resolves disagreements with a fair, evidence-based settlement.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/deals/new" className={CTA_EM}>
                Create a Deal
                <ArrowRight className="size-4" />
              </Link>
              <Link href={`/deals/${DEMO_DEAL_ID}`} className={CTA_LINE}>
                <Play className="size-4 text-blue" />
                Explore Demo
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><Lock className="size-3.5 text-em" />Funds authorized up front via PayPal</span>
              <span className="flex items-center gap-1.5"><UserCheck className="size-3.5 text-em" />Human approval on every release</span>
            </div>
          </div>
          <HeroPreview />
        </div>
      </section>

      <Milestone3D />

      {/* How it works */}
      <section id="how" className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 pt-24 pb-[72px]">
        <div data-reveal="0" className="flex max-w-[640px] flex-col gap-3">
          <Eyebrow>How Settle works</Eyebrow>
          <h2 className={H2}>Every milestone follows the same three steps.</h2>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-px overflow-hidden rounded-[14px] border border-line bg-line">
          {HOW.map(([n, Icon, cls, title, body], i) => (
            <Spot key={n} data-reveal={i} className="flex flex-col gap-3.5 p-7">
              <span className="font-mono text-faint">{n}</span>
              <Icon className={cn("size-[22px]", cls)} />
              <h3 className="m-0 text-[18px] font-semibold">{title}</h3>
              <p className="m-0 text-pretty text-muted-foreground">{body}</p>
            </Spot>
          ))}
        </div>
      </section>

      {/* AI verification */}
      <section id="ai" className="border-t border-line">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-14 px-5 py-[88px]">
          <div data-reveal="0" className="flex min-w-0 flex-col gap-4">
            <Eyebrow tone="blue">AI milestone verification</Eyebrow>
            <h2 className={H2}>A review report both sides can read.</h2>
            <p className="m-0 text-[16px] text-pretty text-muted-foreground">
              Each criterion gets a verdict of pass, fail or unverifiable, with the files and line ranges used as evidence. The AI never releases money. A person always approves.
            </p>
          </div>
          <div data-reveal="2" className="min-w-0 overflow-hidden rounded-[14px] border border-line2 bg-surface shadow-card">
            <div className="flex items-center gap-2.5 border-b border-line px-[18px] py-3.5">
              <Sparkles className="size-4 text-blue" />
              <span className="font-semibold">Invoice builder</span>
              <span className="ml-auto font-mono text-[13px]">72 / 100</span>
            </div>
            {CRITERIA.map(([v, text]) => {
              const s = VERDICT[v];
              return (
                <div key={text} className="flex items-center gap-3 border-b border-line px-[18px] py-[11px] transition-[background,padding] duration-200 last:border-0 hover:bg-chip hover:pl-6">
                  <s.icon className={cn("size-4 flex-none", s.cls)} />
                  <span className="min-w-0 flex-1 text-[13.5px]">{text}</span>
                  <span className={cn("rounded-[5px] px-[7px] py-0.5 font-mono text-[11px] font-medium", s.chip)}>{v}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Disputes */}
      <section id="disputes" className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-14 px-5 py-[88px]">
          <div data-reveal="2" className="order-2 flex min-w-0 flex-col gap-3">
            <Eyebrow tone="amber">Intelligent dispute resolution</Eyebrow>
            <h2 className={H2}>Two advocates negotiate. You both decide.</h2>
            <p className="m-0 text-[16px] text-pretty text-muted-foreground">
              A Freelancer Advocate and a Client Advocate argue from the same review evidence over several rounds, then propose a split. Funds move only when both parties accept.
            </p>
            <Link href={`/deals/${DEMO_DEAL_ID}/dispute`} className="mt-2 flex h-[42px] items-center gap-2 self-start rounded-[9px] border border-line2 bg-background px-4 font-medium text-foreground hover:text-foreground">
              Watch a mediation
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <div data-reveal="0" className="order-1 flex min-w-0 flex-col gap-2.5">
            <div className="flex max-w-[88%] flex-col gap-1.5 self-start rounded-xl border border-line bg-background px-4 py-3.5">
              <span className="flex items-center gap-2 text-[12px] font-semibold text-em"><Bot className="size-3.5" />Freelancer Advocate · 85%</span>
              <span className="text-[13.5px] text-muted-foreground">The persistence API is scoped in Milestone 3, so the failure is partly a scoping overlap.</span>
            </div>
            <div className="flex max-w-[88%] flex-col gap-1.5 self-end rounded-xl border border-line bg-background px-4 py-3.5">
              <span className="flex items-center gap-2 text-[12px] font-semibold text-blue"><Bot className="size-3.5" />Client Advocate · 55%</span>
              <span className="text-[13.5px] text-muted-foreground">We accept the overlap, but the design check is unverified. We propose a partial release.</span>
            </div>
            <div className="flex flex-col gap-2.5 rounded-xl border border-line2 bg-background p-4">
              <div className="flex justify-between text-[13px]"><span className="text-muted-foreground">Proposed settlement</span><span className="font-semibold">70% · $1,680</span></div>
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-[5px]"><span className="w-[70%] bg-em" /><span className="flex-1 bg-blue" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* PayPal workflow */}
      <section id="payments" className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 py-[88px]">
          <div data-reveal="0" className="flex max-w-[640px] flex-col gap-3">
            <Eyebrow>Secure PayPal workflow</Eyebrow>
            <h2 className={H2}>Authorize first. Capture only on approval.</h2>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
            {FLOW.map(([k, cls, title, body], i) => (
              <Spot key={k} tone="blue" data-reveal={i} className="flex flex-col gap-2 rounded-xl border border-line p-5 hover:border-line2">
                <span className={cn("font-mono text-[12px]", cls)}>{k}</span>
                <span className="font-semibold">{title}</span>
                <span className="text-[13.5px] text-muted-foreground">{body}</span>
              </Spot>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-t border-line">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-4 px-5 py-[88px]">
          {BENEFITS.map((b, i) => (
            <Spot key={b.title} tone={b.tone} base="var(--surface)" data-reveal={i} className="flex flex-col gap-[18px] rounded-[14px] border border-line p-8 hover:border-line2">
              <span className="flex items-center gap-2.5 text-[18px] font-semibold">
                <b.icon className={cn("size-5", b.tone === "em" ? "text-em" : "text-blue")} />
                {b.title}
              </span>
              <div className="flex flex-col gap-3 text-muted-foreground">
                {b.items.map((it) => (
                  <span key={it} className="flex gap-2.5">
                    <Check className={cn("mt-[3px] size-4 flex-none", b.tone === "em" ? "text-em" : "text-blue")} />
                    {it}
                  </span>
                ))}
              </div>
            </Spot>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-line">
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,var(--emSoft),transparent)]" />
        <div data-reveal="0" className="relative mx-auto flex max-w-[760px] flex-col items-center gap-5 px-5 py-[104px] text-center">
          <h2 className="m-0 text-[clamp(32px,5vw,52px)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">Protect your next milestone.</h2>
          <p className="m-0 text-[17px] text-muted-foreground">Describe the project. The AI Scoper drafts milestones and criteria in seconds.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/deals/new" className={CTA_EM}>
              Create a Deal
              <ArrowRight className="size-4" />
            </Link>
            <Link href={`/deals/${DEMO_DEAL_ID}`} className={CTA_LINE}>Explore Demo</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-8 px-5 py-12 text-[13.5px] text-muted-foreground">
          <div className="flex flex-col gap-3">
            <span className="flex items-center gap-2.5 text-[16px] font-semibold text-foreground">
              <span className="size-[22px] rounded-md bg-gradient-to-br from-em to-blue" />
              Settle
            </span>
            <span>Milestone payment protection and dispute resolution.</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-foreground">Product</span>
            <a href="#how" className="text-muted-foreground hover:text-foreground">How it works</a>
            <a href="#ai" className="text-muted-foreground hover:text-foreground">AI verification</a>
            <a href="#disputes" className="text-muted-foreground hover:text-foreground">Mediation</a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-foreground">Company</span>
            <a href="#" className="text-muted-foreground hover:text-foreground">About</a>
            <a href="#" className="text-muted-foreground hover:text-foreground">Security</a>
            <a href="#" className="text-muted-foreground hover:text-foreground">Contact</a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-foreground">Legal</span>
            <a href="#" className="text-muted-foreground hover:text-foreground">Terms</a>
            <a href="#" className="text-muted-foreground hover:text-foreground">Privacy</a>
            <span className="text-faint">© 2026 Settle</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
