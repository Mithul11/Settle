import { google } from "@ai-sdk/google";
import { z } from "zod";

// Reads GOOGLE_GENERATIVE_AI_API_KEY from the environment when first called.
export const model = google(process.env.GEMINI_MODEL || "gemini-2.5-flash");

// --- Scoper: job brief -> milestones -------------------------------------
export const ScoperOutputSchema = z.object({
  milestones: z
    .array(
      z.object({
        title: z.string().describe("Short milestone title"),
        criteria: z
          .array(z.string())
          .min(1)
          .describe("Objective, checkable acceptance criteria"),
        amountUSD: z.number().positive().describe("Price in US dollars"),
      }),
    )
    .min(1),
});
export type ScoperOutput = z.infer<typeof ScoperOutputSchema>;

// --- Reviewer: deliverable vs acceptance criteria ------------------------
export const ReviewOutputSchema = z.object({
  criteria: z.array(
    z.object({
      criterion: z.string(),
      pass: z.boolean(),
      evidence: z
        .string()
        .describe("File paths or quotes from the repo that justify the result"),
    }),
  ),
  verdict: z.enum(["PASS", "FAIL"]).describe("Overall verdict"),
  score: z.number().int().min(0).max(100),
});
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;

// --- Mediators: negotiate a split after a dispute ------------------------
export const MediationOutputSchema = z.object({
  turns: z.array(
    z.object({
      speaker: z.enum(["CLIENT_ADVOCATE", "FREELANCER_ADVOCATE"]),
      message: z.string(),
    }),
  ),
  proposedReleasePercent: z
    .number()
    .min(0)
    .max(100)
    .describe("Share of the held amount to release to the freelancer"),
  rationale: z.string(),
});
export type MediationOutput = z.infer<typeof MediationOutputSchema>;
