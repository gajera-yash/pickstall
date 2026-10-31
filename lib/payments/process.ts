import "server-only";

import { collections } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { logger } from "@/lib/logger";
import { providerByName } from "@/lib/payments";
import { scheduleOrderConfirmation } from "@/lib/orders/confirmation";
import type { PaymentEvent } from "@/lib/payments/types";

// The one place an order becomes paid or refunded. Stripe's webhook route and the development-only
// mock both come through here, so no provider has a shortcut (CLAUDE.md 7). Access is never granted
// from the success page; only a verified event gets here.

export type WebhookResult = { status: 200 | 400 | 404 | 500; body: string };

/** Verifies a raw webhook, makes it idempotent (event id inserted first) and applies it to the order. */
export async function handleWebhookRequest(providerName: string, rawBody: string, signature: string | null): Promise<WebhookResult> {
  const provider = providerByName(providerName);
  if (!provider) return { status: 404, body: "not found" };

  const outcome = await provider.handleWebhook(rawBody, signature);
  if (!outcome.ok) return { status: 400, body: outcome.reason };
  if (!outcome.event) return { status: 200, body: "ignored" };

  const { event } = outcome;
  const { webhookEvents } = await collections();
  const key = `${provider.name}:${event.eventId}`;

  try {
    await webhookEvents.insertOne({ _id: key, source: provider.name, type: event.type, orderId: event.orderId ?? null, processedAt: new Date() });
  } catch (error) {
    if (isDuplicateKeyError(error)) return { status: 200, body: "duplicate" };
    logger.error("webhook.record_failed", { name: error instanceof Error ? error.name : undefined });
    return { status: 500, body: "error" };
  }

  try {
    await applyEvent(event);
    return { status: 200, body: "ok" };
  } catch (error) {
    // Let the provider retry: forget the event so the replay is processed.
    await webhookEvents.deleteOne({ _id: key }).catch(() => undefined);
    logger.error("webhook.apply_failed", { name: error instanceof Error ? error.name : undefined });
    return { status: 500, body: "error" };
  }
}

async function applyEvent(event: PaymentEvent): Promise<void> {
  const { orders } = await collections();

  // A refund may only know the provider's payment id; find our order through it.
  if (event.type === "payment.refunded") {
    const match = event.orderId ? { _id: event.orderId } : event.providerPaymentId ? { providerPaymentId: event.providerPaymentId } : null;
    if (!match) return;
    await orders.updateOne({ ...match, status: "paid" }, { $set: { status: "refunded" } });
    return;
  }
  if (!event.orderId) return;

  if (event.type === "payment.succeeded") {
    const order = await orders.findOne({ _id: event.orderId }, { projection: { totalCents: 1, currency: 1, status: 1 } });
    if (!order) return;
    const mismatch =
      (event.amountCents !== undefined && event.amountCents !== order.totalCents) ||
      (event.currency !== undefined && event.currency.toLowerCase() !== order.currency.toLowerCase());
    if (mismatch) {
      logger.error("webhook.amount_mismatch", { orderId: event.orderId });
      return; // never mark an order paid for a different amount
    }
    // Only a pending order becomes paid; a second delivery changes nothing.
    await orders.updateOne(
      { _id: event.orderId, status: "pending" },
      { $set: { status: "paid", paidAt: new Date(), ...(event.providerPaymentId ? { providerPaymentId: event.providerPaymentId } : {}) } },
    );
    // The order email goes out after the response; a replay is safe (one outbox row per order).
    scheduleOrderConfirmation(event.orderId);
  }
}

/** A free product has no payment step: this marks its zero-amount order paid (only if it really is free and pending). */
export async function markFreeOrderPaid(orderId: string): Promise<void> {
  const { orders } = await collections();
  const result = await orders.updateOne({ _id: orderId, status: "pending", provider: "free", totalCents: 0 }, { $set: { status: "paid", paidAt: new Date() } });
  if (result.matchedCount === 1) scheduleOrderConfirmation(orderId);
}
