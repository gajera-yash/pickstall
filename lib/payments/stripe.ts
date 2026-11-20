import "server-only";

import Stripe from "stripe";

import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { isOwnTestAccount, liveKey } from "@/lib/payments/test-account";
import type { CheckoutInput, PaymentEvent, PaymentProvider, RefundInput, WebhookEndpoint, WebhookOutcome } from "@/lib/payments/types";

// Stripe adapter (CLAUDE.md 7, D-053): Standard connected accounts, Checkout Sessions as DIRECT
// charges on the creator's account (`stripeAccount` option). No application fee, no transfers, no
// destination charges. Prices come from our database. Payment methods are not listed, so Stripe's
// dynamic payment methods apply; with direct charges the CONNECTED account's own payment method
// settings decide what its buyers see (docs.stripe.com/payments/payment-methods/dynamic-payment-methods).
// Test mode keys until the founder approves live mode.

/** A pending checkout expires after this long; Stripe allows 30 minutes to 24 hours. */
const CHECKOUT_EXPIRES_MINUTES = 60;

export function stripeConfigured(): boolean {
  return Boolean(serverEnv.STRIPE_SECRET_KEY && serverEnv.STRIPE_CONNECT_WEBHOOK_SECRET);
}

let cached: Stripe | null = null;

/** The Stripe client. Only files in lib/payments/ use it. */
export function stripeClient(): Stripe {
  if (!serverEnv.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured.");
  cached ??= new Stripe(serverEnv.STRIPE_SECRET_KEY);
  return cached;
}

/** Request options for acting on a creator's account. Our own test account takes plain requests (Stripe rejects "on behalf of" yourself). */
function onAccount(accountId: string): Stripe.RequestOptions {
  return isOwnTestAccount(accountId) ? {} : { stripeAccount: accountId };
}

function idOf(value: string | { id: string } | null | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.id;
}

/** The subscription a billing event is about, or null for any other event. */
function billingSubscriptionOf(event: Stripe.Event): string | undefined {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      return event.data.object.id;
    case "invoice.paid":
    case "invoice.payment_failed":
      return idOf(event.data.object.parent?.subscription_details?.subscription);
    case "checkout.session.completed":
      return event.data.object.mode === "subscription" ? idOf(event.data.object.subscription) : undefined;
    default:
      return undefined;
  }
}

/**
 * Turns a verified Stripe event into our normalized event, or null when it does not concern us.
 * Exported for unit tests; the webhook goes through `handleWebhook`.
 */
export function normalizeStripeEvent(event: Stripe.Event, endpoint: WebhookEndpoint): PaymentEvent | null {
  // Production Connect endpoints receive both live and test events (docs.stripe.com/connect/webhooks).
  if (event.livemode !== liveKey()) return null;

  // Platform billing (D-073): the creator's own subscription to a Pickstall plan. Only ever on the
  // platform endpoint (our account); the handler fetches the subscription from Stripe and saves it.
  if (endpoint === "platform") {
    const subscriptionId = billingSubscriptionOf(event);
    // A paid plan invoice is also saved for the admin's revenue (D-116).
    const invoiceId = event.type === "invoice.paid" ? event.data.object.id : undefined;
    if (subscriptionId) return { eventId: event.id, type: "billing.subscription", subscriptionId, ...(invoiceId ? { invoiceId } : {}) };
  }

  // Which seller account the event belongs to. On the Connect endpoint Stripe names it; on the
  // platform endpoint it is our own account, which only the test seller shortcut (D-034) sells from.
  const account = endpoint === "connect" ? (event.account ?? null) : (serverEnv.STRIPE_PLATFORM_ACCOUNT_ID ?? null);
  if (!account) return null;

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const orderId = session.metadata?.order_id ?? session.client_reference_id;
      // A delayed method (bank debit) completes the session unpaid; async_payment_succeeded follows.
      if (!orderId || session.payment_status !== "paid") return null;
      return {
        eventId: event.id,
        type: "payment.succeeded",
        account,
        orderId,
        providerSessionId: session.id,
        providerPaymentId: idOf(session.payment_intent),
        amountCents: session.amount_total ?? undefined,
        currency: session.currency ?? undefined,
      };
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object;
      return {
        eventId: event.id,
        type: "payment.failed",
        account,
        orderId: session.metadata?.order_id ?? session.client_reference_id ?? null,
        providerSessionId: session.id,
      };
    }
    case "charge.refunded": {
      // Sent for full and partial refunds; `refunded` is true only when the whole charge is refunded.
      const charge = event.data.object;
      const paymentId = idOf(charge.payment_intent);
      if (!paymentId) return null;
      return {
        eventId: event.id,
        type: "payment.refunded",
        account,
        orderId: charge.metadata?.order_id ?? null,
        providerPaymentId: paymentId,
        amountRefundedCents: charge.amount_refunded,
        fullyRefunded: charge.refunded,
      };
    }
    case "account.updated": {
      if (endpoint !== "connect") return null;
      const acct = event.data.object;
      return {
        eventId: event.id,
        type: "account.updated",
        account: acct.id,
        status: { chargesEnabled: Boolean(acct.charges_enabled), payoutsEnabled: Boolean(acct.payouts_enabled), detailsSubmitted: Boolean(acct.details_submitted) },
      };
    }
    case "account.application.deauthorized":
      // The creator disconnected Pickstall from their Stripe Dashboard.
      return endpoint === "connect" ? { eventId: event.id, type: "account.deauthorized", account } : null;
    default:
      return null;
  }
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",

  async createCheckout(input: CheckoutInput) {
    if (!input.connectedAccountId) throw new Error("This store has not connected Stripe.");
    const session = await stripeClient().checkout.sessions.create(
      {
        mode: "payment",
        customer_email: input.buyerEmail,
        line_items: [
          {
            quantity: 1,
            // Stripe amount units for this currency (D-046): zero-decimal currencies are whole units.
            price_data: { currency: input.currency, unit_amount: input.amountCents, product_data: { name: input.title } },
          },
        ],
        metadata: { order_id: input.orderId },
        // Copied to the charge, so refund events can name our order too.
        payment_intent_data: { metadata: { order_id: input.orderId } },
        client_reference_id: input.orderId,
        expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRES_MINUTES * 60,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      },
      // One session per order: a retried request returns the same session instead of a second one.
      { ...onAccount(input.connectedAccountId), idempotencyKey: `checkout:${input.orderId}` },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { url: session.url, providerSessionId: session.id };
  },

  async handleWebhook(rawBody: string, signature: string | null, endpoint: WebhookEndpoint = "connect"): Promise<WebhookOutcome> {
    // Separate secrets for the platform and the Connect endpoint (CLAUDE.md 7).
    const secret = endpoint === "connect" ? serverEnv.STRIPE_CONNECT_WEBHOOK_SECRET : serverEnv.STRIPE_PLATFORM_WEBHOOK_SECRET;
    if (!secret || !signature || !serverEnv.STRIPE_SECRET_KEY) return { ok: false, reason: "bad_signature" };

    let event: Stripe.Event;
    try {
      event = stripeClient().webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      return { ok: false, reason: "bad_signature" };
    }
    const normalized = normalizeStripeEvent(event, endpoint);
    if (!normalized) logger.info("stripe.webhook_ignored", { type: event.type, endpoint });
    return { ok: true, event: normalized };
  },

  async refund(input: RefundInput) {
    if (!input.connectedAccountId) throw new Error("This store has not connected Stripe.");
    // A direct charge is refunded on the creator's own account, from their Stripe balance. There is
    // no application fee to refund. The charge.refunded webhook then marks the order refunded.
    await stripeClient().refunds.create(
      { payment_intent: input.providerPaymentId, metadata: { order_id: input.orderId } },
      { ...onAccount(input.connectedAccountId), idempotencyKey: `refund:${input.orderId}` },
    );
  },
};
