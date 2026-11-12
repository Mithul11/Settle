import "server-only";
import { generateText, Output } from "ai";
import {
  MediationOutputSchema,
  model,
  ReviewOutputSchema,
  ScoperOutputSchema,
  type MediationOutput,
  type ReviewOutput,
  type ScoperOutput,
} from "./ai";
import type { RepoContext } from "./github";
import { HttpError } from "./http";

// The three Gemini agents. They only read and propose: this module must
// never import lib/paypal.ts and never touches milestone money fields.

function ensureConfigured() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new HttpError(503, "AI is not configured: set GOOGLE_GENERATIVE_AI_API_KEY");
  }
}

async function run<T>(label: string, fn: () => Promise<T>): Promise<T> {
  ensureConfigured();
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error(`${label} failed:`, error instanceof Error ? error.message : error);
    throw new HttpError(502, `${label} failed. Try again in a moment.`);
  }
}

// --- Scoper ---------------------------------------------------------------
export function scopeDeal(title: string, brief: string): Promise<ScoperOutput> {
  return run("AI Scoper", async () => {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: ScoperOutputSchema }),
      system:
        "You are the Scoper for Settle, a milestone payment platform for freelance software work. " +
        "Split a project into 2 to 5 sequential milestones that can each be delivered as a GitHub repository. " +
        "Every acceptance criterion must be objective and checkable by reading code (files, tests, behaviour), " +
        "never subjective ('looks good'). Give 3 to 6 criteria per milestone. " +
        "Price each milestone in whole US dollars, proportional to its effort, with realistic freelance rates.",
      prompt: `Project title: ${title}\n\nProject description:\n${brief}`,
    });
    return output;
  });
}

// --- Reviewer -------------------------------------------------------------
function repoPrompt(repo: RepoContext): string {
  const files = repo.files.map((f) => `--- ${f.path}${f.truncated ? " (truncated)" : ""}\n${f.content}`).join("\n\n");
  return [
    `Repository: github.com/${repo.owner}/${repo.repo} @ ${repo.ref}`,
    repo.description ? `Description: ${repo.description}` : "",
    `File tree${repo.treeTruncated ? " (truncated)" : ""}:\n${repo.tree.join("\n")}`,
    repo.readme ? `README:\n${repo.readme}` : "README: none",
    files ? `Key files:\n${files}` : "Key files: none could be read",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function reviewDeliverable(input: {
  milestoneTitle: string;
  criteria: string[];
  note: string | null;
  repo: RepoContext;
}): Promise<ReviewOutput> {
  return run("AI Reviewer", async () => {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: ReviewOutputSchema }),
      system:
        "You are the Reviewer for Settle. You check a freelancer's GitHub deliverable against acceptance criteria. " +
        "You only report; you never decide payments. Judge strictly from the repository snapshot you are given. " +
        "Return exactly one entry per criterion, in the given order, with `name` equal to the criterion text. " +
        "For each: pass true only when the code clearly meets it; verdict FAIL when the code shows it is not met; " +
        "verdict UNVERIFIABLE (pass false) when the snapshot cannot show it either way (for example visual design or files not included). " +
        "Evidence must cite concrete file paths (with line ranges when you can) or quote code; never invent files. " +
        "Score 0-100 reflects how much of the agreed scope is delivered. Overall verdict PASS only if no criterion is FAIL.",
      prompt: [
        `Milestone: ${input.milestoneTitle}`,
        `Acceptance criteria:\n${input.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
        input.note ? `Freelancer's submission note: ${input.note}` : "",
        repoPrompt(input.repo),
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    return output;
  });
}

// --- Mediators ------------------------------------------------------------
export function mediateDispute(input: {
  milestoneTitle: string;
  amount: string;
  criteria: string[];
  reason: string | null;
  review: ReviewOutput | null;
  note: string | null;
}): Promise<MediationOutput> {
  return run("AI Mediation", async () => {
    const reviewText = input.review
      ? `AI review: score ${input.review.score}, verdict ${input.review.verdict}.\n` +
        input.review.criteria
          .map((c, i) => `${i + 1}. ${c.name}: ${c.verdict ?? (c.pass ? "PASS" : "FAIL")} — ${c.evidence}`)
          .join("\n")
      : "No AI review is on record.";
    const { output } = await generateText({
      model,
      output: Output.object({ schema: MediationOutputSchema }),
      system:
        "You simulate a fair negotiation between two AI advocates in a milestone payment dispute. " +
        "FREELANCER_MEDIATOR argues for the freelancer, CLIENT_MEDIATOR for the client. Both argue only from the evidence given " +
        "(acceptance criteria, AI review, dispute reason, submission note) and must not invent facts. " +
        "Write 2 or 3 rounds; each round is one FREELANCER_MEDIATOR turn followed by one CLIENT_MEDIATOR turn. " +
        "Each turn states a positionPercent (the share of the held amount it argues should be released to the freelancer) " +
        "and a short evidence reference. Positions must converge round by round. " +
        "Finish with proposedReleasePercent (an integer between the final positions) and a neutral rationale of 2-3 sentences " +
        "that a non-technical client can read. No money moves until both parties accept.",
      prompt: [
        `Milestone: ${input.milestoneTitle} (held amount ${input.amount} USD)`,
        `Acceptance criteria:\n${input.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
        `Dispute reason from the client: ${input.reason ?? "not given"}`,
        input.note ? `Freelancer's submission note: ${input.note}` : "",
        reviewText,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    return output;
  });
}
