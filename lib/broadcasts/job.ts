import "server-only";

import { after } from "next/server";

import { markBroadcastFailed, sendNextBatch } from "@/lib/broadcasts/queries";
import { inngest, inngestEnabled } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";

// Sending a broadcast in the background (D-095). One Inngest step per batch of 100, so a retry
// repeats only the batch that failed (and Resend's idempotency key stops even that from sending
// twice). One broadcast at a time across the platform keeps us under Resend's 10 requests/second.

export const BROADCAST_EVENT = "broadcast/send";
/** 50,000 subscribers at most (the biggest plan) in batches of 100. */
const MAX_BATCHES = 600;

export const broadcastSendFunction = inngest.createFunction(
  { id: "broadcast-send", triggers: [{ event: BROADCAST_EVENT }], concurrency: { limit: 1 }, retries: 5 },
  async ({ event, step }) => {
    const broadcastId = typeof event.data?.broadcastId === "string" ? event.data.broadcastId : null;
    if (!broadcastId) return { skipped: "no broadcast" };
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const result = await step.run(`batch-${batch}`, () => sendNextBatch(broadcastId));
      if (result.done) return { batches: batch + 1 };
    }
    await step.run("too-many-batches", () => markBroadcastFailed(broadcastId));
    return { failed: "too many batches" };
  },
);

/**
 * Starts sending. With Inngest (production) it queues the job; development without Inngest sends
 * after the response. Returns false when it could not be started.
 */
export async function startBroadcastJob(broadcastId: string): Promise<boolean> {
  if (inngestEnabled()) {
    try {
      await inngest.send({ id: `broadcast-${broadcastId}`, name: BROADCAST_EVENT, data: { broadcastId } });
      return true;
    } catch (error) {
      logger.error("broadcasts.start_failed", { name: error instanceof Error ? error.name : undefined });
      return false;
    }
  }
  if (process.env.NODE_ENV === "production") return false;
  after(async () => {
    try {
      for (let batch = 0; batch < MAX_BATCHES; batch++) if ((await sendNextBatch(broadcastId)).done) return;
    } catch (error) {
      logger.error("broadcasts.dev_send_failed", { name: error instanceof Error ? error.name : undefined });
      await markBroadcastFailed(broadcastId);
    }
  });
  return true;
}
