import "server-only";

import { inngest, inngestEnabled } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";
import { sendReviewRequest } from "@/lib/review-request/queries";
import { REVIEW_REQUEST_DELAY_MS } from "@/lib/review-request/rules";

// The "please review" job (D-117): waits a week after an order is paid, then sends the request if
// it still applies (lib/review-request/queries.ts decides).

export const ORDER_PAID_REVIEW_EVENT = "order/paid-review";

export const reviewRequestFunction = inngest.createFunction(
  { id: "review-request", triggers: [{ event: ORDER_PAID_REVIEW_EVENT }] },
  async ({ event, step }) => {
    const orderId = typeof event.data?.orderId === "string" ? event.data.orderId : null;
    const paidAt = typeof event.data?.paidAt === "string" ? new Date(event.data.paidAt) : null;
    if (!orderId || !paidAt || Number.isNaN(paidAt.getTime())) return { skipped: "bad event" };
    await step.sleepUntil("wait", new Date(paidAt.getTime() + REVIEW_REQUEST_DELAY_MS));
    return { result: await step.run("send", () => sendReviewRequest(orderId)) };
  },
);

/**
 * Queues the review request for an order that just became paid. The event id is the order id, so
 * a replayed webhook queues nothing new. Without Inngest nothing is queued (development). Never throws.
 */
export async function scheduleReviewRequest(orderId: string, paidAt: Date = new Date()): Promise<void> {
  if (!inngestEnabled()) return;
  try {
    await inngest.send({ id: `review-request-${orderId}`, name: ORDER_PAID_REVIEW_EVENT, data: { orderId, paidAt: paidAt.toISOString() } });
  } catch (error) {
    logger.error("review_request.schedule_failed", { name: error instanceof Error ? error.name : undefined });
  }
}
