import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

/**
 * Append an entry to the audit trail. `milestoneId` may be null for events
 * that cannot be matched to a milestone (for example an unknown webhook).
 */
export async function logEvent(
  milestoneId: string | null,
  type: string,
  payload: unknown = {},
) {
  return prisma.event.create({
    data: {
      milestoneId,
      type,
      // Round-trip through JSON so SDK objects and Dates become plain JSON.
      payload: JSON.parse(JSON.stringify(payload ?? {})) as Prisma.InputJsonValue,
    },
  });
}
