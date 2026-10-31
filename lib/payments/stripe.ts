import "server-only";

import Stripe from "stripe";

import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { isOwnTestAccount } from "@/lib/payments/test-account";
import type { CheckoutInput, PaymentEvent, PaymentProvider, WebhookOutcome } from "@/lib/payments/types";

// Stripe adapter (CLAUDE.md 7): Standard connected accounts, Checkout Sessions as DIRECT charges on
// the creator's account (`stripeAccount` option). No application fee, no transfers, no destination
// charges. Prices come from our database. Payment methods are not listed, so Stripe's dynamic
// payment methods decide what each creator's buyers see. Needs STRIPE_SECRET_KEY and
// STRIPE_CONNECT_WEBHOOK_SECRET (test mode keys until the founder approves live mode).

export function stripeConfigured(): boolean {
  return Boolean(serverEnv.STRIPE_SECRET_KEY && serverEnv.STRIPE_CONNECT_WEBHOOK_SECRET);
}

function client(): Stripe {
  if (!serverEnv.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured.");
  return new Stripe(serverEnv.STRIPE_SECRET_KEY);
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",

  async createCheckout(input: CheckoutInput) {
    if (!input.connectedAccountId) throw new Error("This store has not connected Stripe.");
    // A direct charge on the creator's account. When that account IS our own test account there is
    // nothing to act on behalf of (Stripe rejects it), so the request is a plain charge on it.
    const ownTestAccount = isOwnTestAccount(input.connectedAccountId);
    const session = await client().checkout.sessions.create(
      {
        mode: "payment",
        customer_email: input.buyerEmail,
        line_items: [
          {
            quantity: 1,
            price_data: { currency: input.currency, unit_amount: input.amountCents, product_data: { name: input.title } },
          },
        ],
        metadata: { order_id: input.orderId },
        client_reference_id: input.orderId,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      },
      ownTestAccount ? undefined : { stripeAccount: input.connectedAccountId },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { url: session.url, providerSessionId: session.id };
  },

  async handleWebhook(rawBody: string, signature: string | null): Promise<WebhookOutcome> {
    const secret = serverEnv.STRIPE_CONNECT_WEBHOOK_SECRET;
    if (!secret || !signature) return { ok: false, reason: "bad_signature" };

    let event: Stripe.Event;
    try {
      event = client().webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      return { ok: false, reason: "bad_signature" };
    }

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      const orderId = session.metadata?.order_id ?? session.client_reference_id;
      if (!orderId || session.payment_status !== "paid") {
        logger.info("stripe.webhook_ignored", { type: event.type, paymentStatus: session.payment_status, hasOrderId: Boolean(orderId) });
        return { ok: true, event: null };
      }
      const normalized: PaymentEvent = {
        eventId: event.id,
        type: "payment.succeeded",
        orderId,
        providerSessionId: session.id,
        amountCents: session.amount_total ?? undefined,
        currency: session.currency ?? undefined,
      };
      return { ok: true, event: normalized };
    }
    logger.info("stripe.webhook_ignored", { type: event.type });
    return { ok: true, event: null };
  },

  async refund() {
    // Refunds are made by the creator in their own Stripe dashboard; the charge.refunded webhook
    // revokes access (R7). Nothing to call from here.
  },
};
