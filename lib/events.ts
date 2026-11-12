import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { EVENT_TYPES, type EventType } from "./types";

export { EVENT_TYPES };
export type { EventType };

/**
 * Append an entry to the audit trail. `milestoneId` may be null for events
 * that cannot be matched to a milestone (for example an unknown webhook).
 * `type` is one of EVENT_TYPES. Payloads carry amounts as strings and any
 * PayPal ids (orderId, authorizationId, captureId).
 */
export async function logEvent(
  milestoneId: string | null,
  type: EventType | (string & {}),
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
