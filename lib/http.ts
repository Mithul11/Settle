import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";

// Shared helpers for API route handlers. Error bodies follow the spec:
// { error: string, details?: unknown } with 400/404/409/422/502/503.

export function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json(details === undefined ? { error } : { error, details }, { status });
}

/** Parse a JSON body against a zod schema. Returns the data or a 400 response. */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: NextResponse }> {
  const raw = await request.json().catch(() => undefined);
  if (raw === undefined) return { response: jsonError(400, "Request body must be JSON") };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      response: jsonError(
        400,
        "Invalid request",
        parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`),
      ),
    };
  }
  return { data: parsed.data };
}

/** Error with an HTTP status, thrown by shared server logic and mapped by routes. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function errorResponse(error: unknown, fallback = "Request failed") {
  if (error instanceof HttpError) return jsonError(error.status, error.message, error.details);
  console.error(fallback, error instanceof Error ? error.message : error);
  return jsonError(500, fallback);
}
