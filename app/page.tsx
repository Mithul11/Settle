import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DEMO_DEAL_ID } from "@/lib/demo-deal";

const STEPS = [
  {
    title: "Fund",
    text: "The client funds a milestone with PayPal. The money is authorized and held, not paid.",
  },
  {
    title: "Review",
    text: "An AI Reviewer checks the GitHub deliverable against the agreed acceptance criteria.",
  },
  {
    title: "Settle",
    text: "Pass: the payment is released. Dispute: two AI Mediators negotiate a fair split.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16">
      <p className="text-sm font-medium text-muted-foreground">Settle</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">
        AI escrow for freelancers
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Clients hold the payment with PayPal. An AI agent checks the work against
        the agreed criteria. Nobody gets paid late, and nobody pays for work that
        was not delivered.
      </p>

      <div className="mt-8">
        {/* Until the Scoper agent lands, this opens the built-in demo deal. */}
        <Link href={`/deals/${DEMO_DEAL_ID}`} className={buttonVariants({ size: "lg" })}>
          Create a deal
        </Link>
      </div>

      <ol className="mt-12 grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <p className="text-sm text-muted-foreground">Step {index + 1}</p>
            <h2 className="mt-1 font-medium">{step.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
