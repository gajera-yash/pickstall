import "server-only";

import { REMINDER_DELAY_MS } from "@/lib/abandoned-cart/rules";
import { sendCartReminder } from "@/lib/abandoned-cart/queries";
import { inngest, inngestEnabled } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";

// The abandoned cart reminder job (D-096): waits two hours after a paid checkout starts, then
// sends the reminder if the order is still unfinished (lib/abandoned-cart/queries.ts decides).

export const CHECKOUT_STARTED_EVENT = "checkout/started";

export const cartReminderFunction = inngest.createFunction(
  { id: "abandoned-cart-reminder", triggers: [{ event: CHECKOUT_STARTED_EVENT }] },
  async ({ event, step }) => {
    const orderId = typeof event.data?.orderId === "string" ? event.data.orderId : null;
    const startedAt = typeof event.data?.startedAt === "string" ? new Date(event.data.startedAt) : null;
    if (!orderId || !startedAt || Number.isNaN(startedAt.getTime())) return { skipped: "bad event" };
    await step.sleepUntil("wait", new Date(startedAt.getTime() + REMINDER_DELAY_MS));
    return { result: await step.run("send", () => sendCartReminder(orderId)) };
  },
);

/**
 * Queues the reminder check for a paid checkout that just started. Without Inngest nothing is
 * queued (development): reminders need the background job. Never throws.
 */
export async function scheduleCartReminder(orderId: string, startedAt: Date): Promise<void> {
  if (!inngestEnabled()) return;
  try {
    await inngest.send({ id: `checkout-started-${orderId}`, name: CHECKOUT_STARTED_EVENT, data: { orderId, startedAt: startedAt.toISOString() } });
  } catch (error) {
    logger.error("abandoned_cart.schedule_failed", { name: error instanceof Error ? error.name : undefined });
  }
}
