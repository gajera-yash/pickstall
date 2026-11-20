import "server-only";

import { confirmBookingForOrder, releaseBookingForOrder } from "@/lib/coaching/bookings";
import { createBumpOrder, refundBumpOrder } from "@/lib/bumps/queries";
import { cancelBookingOfRefundedOrder } from "@/lib/coaching/calls";
import { scheduleCallReminders } from "@/lib/coaching/reminders";
import { redeemCouponForOrder, releaseCouponForOrder } from "@/lib/coupons/queries";
import { collections } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { addSubscriberForOrder } from "@/lib/subscribers/queries";
import { issueLicenseForOrder } from "@/lib/licenses/queries";
import { logger } from "@/lib/logger";
import { providerByName } from "@/lib/payments";
import { notifyOrderPaid, notifyRefund } from "@/lib/notifications/queries";
import { scheduleOrderConfirmation } from "@/lib/orders/confirmation";
import { recordPlanInvoice, syncSubscription } from "@/lib/plans/billing-sync";
import type { PaymentEvent, PaymentProvider, WebhookEndpoint } from "@/lib/payments/types";
import { applyStripeAccountStatus, detachStripeAccount, stripeAccountOfStore } from "@/lib/stores/queries";

// The one place an order becomes paid, failed or refunded. Stripe's webhook routes and the
// development-only mock all come through here, so no provider has a shortcut (CLAUDE.md 7). Access
// is never granted from the success page; only a verified event gets here.

export type WebhookResult = { status: 200 | 400 | 404 | 500; body: string };

/** Verifies a raw webhook, makes it idempotent (event id inserted first) and applies it. */
export async function handleWebhookRequest(
  providerName: string,
  rawBody: string,
  signature: string | null,
  endpoint: WebhookEndpoint = "connect",
): Promise<WebhookResult> {
  const provider = providerByName(providerName);
  if (!provider) return { status: 404, body: "not found" };

  const outcome = await provider.handleWebhook(rawBody, signature, endpoint);
  if (!outcome.ok) return { status: 400, body: outcome.reason };
  if (!outcome.event) return { status: 200, body: "ignored" };

  const { event } = outcome;
  const { webhookEvents } = await collections();
  const key = `${provider.name}:${event.eventId}`;
  const orderId = "orderId" in event ? event.orderId : null;

  try {
    await webhookEvents.insertOne({ _id: key, source: provider.name, type: event.type, orderId, processedAt: new Date() });
  } catch (error) {
    if (isDuplicateKeyError(error)) return { status: 200, body: "duplicate" };
    logger.error("webhook.record_failed", { name: error instanceof Error ? error.name : undefined });
    return { status: 500, body: "error" };
  }

  try {
    await applyEvent(provider.name, event);
    return { status: 200, body: "ok" };
  } catch (error) {
    // Let the provider retry: forget the event so the replay is processed.
    await webhookEvents.deleteOne({ _id: key }).catch(() => undefined);
    logger.error("webhook.apply_failed", { name: error instanceof Error ? error.name : undefined });
    return { status: 500, body: "error" };
  }
}

/**
 * The event must come from the seller account of the order's store. Without this, a creator could
 * send events from their own Stripe account that name another store's order (R9). The mock has no
 * accounts (`undefined`), so there is nothing to compare.
 */
async function fromStoreAccount(event: { account?: string | null }, storeId: string): Promise<boolean> {
  if (event.account === undefined) return true;
  const expected = await stripeAccountOfStore(storeId);
  return expected !== null && event.account === expected;
}

/** Issues a license key (D-114); a failure is logged and never undoes or blocks the sale. */
async function issueLicenseSafely(orderId: string): Promise<void> {
  await issueLicenseForOrder(orderId).catch((error: unknown) => logger.error("licenses.issue_failed", { orderId, name: error instanceof Error ? error.name : undefined }));
}

/**
 * Runs once per order when it becomes paid. Fulfilment of a digital product is the buyer library
 * (it reads paid orders) plus the confirmation email. Other order kinds add their own idempotent
 * step here, keyed by the order id: a coaching call confirms its booked time (D-083).
 */
async function onOrderPaid(orderId: string): Promise<void> {
  await redeemCouponForOrder(orderId); // no coupon: nothing happens (D-088)
  // No booking (not a coaching order): nothing happens. A confirmed call gets its reminders (D-085).
  if ((await confirmBookingForOrder(orderId)) === "confirmed") await scheduleCallReminders(orderId);
  // A license key (D-114) before the email, which includes it. Once per order; a problem is only
  // logged, so the sale and the email still go through (the creator can see a key is missing).
  await issueLicenseSafely(orderId);
  scheduleOrderConfirmation(orderId); // a replay is safe: one outbox row per order
  // An order bump (D-089): its product gets its own $0 order (once), with its own access email.
  const bumpOrderId = await createBumpOrder(orderId);
  if (bumpOrderId) {
    await issueLicenseSafely(bumpOrderId);
    scheduleOrderConfirmation(bumpOrderId);
  }
  await notifyOrderPaid(orderId); // one "New sale" per order (dedupe key); never throws (D-061)
  // The email list (D-094): only with the consent saved on the order; an upsert, so replays are safe.
  // A list problem must never undo or block the sale, so it is only logged.
  await addSubscriberForOrder(orderId).catch((error: unknown) => logger.error("subscribers.add_failed", { orderId, name: error instanceof Error ? error.name : undefined }));
}

async function applyEvent(providerName: PaymentProvider["name"], event: PaymentEvent): Promise<void> {
  const { orders } = await collections();

  switch (event.type) {
    case "billing.subscription":
      // Fetches the subscription from Stripe and saves it: replays and out-of-order events end the same.
      await syncSubscription(event.subscriptionId);
      // A paid plan invoice (D-116): saved once by its id, fetched from Stripe, never from the body.
      if (event.invoiceId) await recordPlanInvoice(event.invoiceId);
      return;

    case "account.updated":
      await applyStripeAccountStatus(event.account, event.status);
      return;

    case "account.deauthorized":
      await detachStripeAccount(event.account);
      return;

    case "payment.succeeded": {
      // The event must belong to the checkout session we created for this order (R9).
      const binding = { _id: event.orderId, provider: providerName, providerSessionId: event.providerSessionId };
      const order = await orders.findOne(binding, { projection: { storeId: 1, totalCents: 1, currency: 1 } });
      if (!order || !(await fromStoreAccount(event, order.storeId))) {
        logger.error("webhook.session_mismatch", { orderId: event.orderId });
        return;
      }
      const mismatch =
        (event.amountCents !== undefined && event.amountCents !== order.totalCents) ||
        (event.currency !== undefined && event.currency.toLowerCase() !== order.currency.toLowerCase());
      if (mismatch) {
        logger.error("webhook.amount_mismatch", { orderId: event.orderId });
        return; // never mark an order paid for a different amount
      }
      // Only a pending order becomes paid; a second delivery changes nothing. A failed (expired)
      // order cannot be paid by its session any more, so only "pending" is accepted.
      await orders.updateOne(
        { ...binding, status: "pending" },
        { $set: { status: "paid", paidAt: new Date(), ...(event.providerPaymentId ? { providerPaymentId: event.providerPaymentId } : {}) } },
      );
      // Also on a retried delivery after a failure: every step after "paid" is idempotent per order.
      await onOrderPaid(event.orderId);
      return;
    }

    case "payment.failed": {
      const match = { provider: providerName, providerSessionId: event.providerSessionId, ...(event.orderId ? { _id: event.orderId } : {}) };
      const order = await orders.findOne(match, { projection: { storeId: 1 } });
      if (!order || !(await fromStoreAccount(event, order.storeId))) return;
      await orders.updateOne({ _id: order._id, status: "pending" }, { $set: { status: "failed" } });
      // A failed or expired checkout gives its coaching time (D-083) and its coupon use (D-088) back.
      await releaseBookingForOrder(order._id);
      await releaseCouponForOrder(order._id);
      return;
    }

    case "payment.refunded": {
      // Found through the payment id we saved when the order was paid; only an order of this provider.
      const match = event.providerPaymentId ? { providerPaymentId: event.providerPaymentId } : event.orderId ? { _id: event.orderId } : null;
      if (!match) return;
      const order = await orders.findOne({ ...match, provider: providerName }, { projection: { storeId: 1, totalCents: 1 } });
      if (!order || !(await fromStoreAccount(event, order.storeId))) return;
      const refunded = event.amountRefundedCents ?? order.totalCents;
      // $max: events can arrive out of order; the refunded amount never goes down.
      const changed = await orders.updateOne(
        { _id: order._id, status: "paid" },
        event.fullyRefunded
          ? { $set: { status: "refunded", refundedAt: new Date() }, $max: { amountRefundedCents: refunded } }
          : { $max: { amountRefundedCents: refunded } },
      );
      // Only when this event changed the order, so a replay does not notify again (D-061).
      if (changed.modifiedCount === 1) await notifyRefund(order._id, refunded, Boolean(event.fullyRefunded));
      // A full refund cancels a coaching call (D-086) and removes an order bump's product (D-089) too,
      // wherever it was made.
      if (event.fullyRefunded) {
        await cancelBookingOfRefundedOrder(order._id);
        await refundBumpOrder(order._id);
      }
      return;
    }
  }
}

/** A free product has no payment step: this marks its zero-amount order paid (only if it really is free and pending). */
export async function markFreeOrderPaid(orderId: string): Promise<void> {
  const { orders } = await collections();
  const result = await orders.updateOne({ _id: orderId, status: "pending", provider: "free", totalCents: 0 }, { $set: { status: "paid", paidAt: new Date() } });
  if (result.matchedCount === 1) await onOrderPaid(orderId);
}
