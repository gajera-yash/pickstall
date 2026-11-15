import "server-only";

import type Stripe from "stripe";

import { PAID_PLANS, PLANNED_PRICE_CENTS, type PaidPlan } from "@/lib/config";
import { serverEnv } from "@/lib/env.server";
import { stripeClient } from "@/lib/payments/stripe";

// Platform billing (D-073): creators pay Pickstall for a plan through Stripe Billing subscriptions on
// OUR OWN Stripe account (CLAUDE.md 7: the only way the platform earns). Nothing here touches a
// creator's connected account, sets an application fee or moves creator money. Stripe stays in test
// mode until the founder approves live mode. Stripe SDK types never leave lib/payments/.

/** A subscription as the rest of the app sees it (no Stripe types). */
export type SubscriptionState = {
  subscriptionId: string;
  customerId: string;
  /** Our store id, from the metadata we set when the creator subscribed. */
  storeId: string | null;
  plan: PaidPlan | null;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export function billingConfigured(): boolean {
  return Boolean(serverEnv.STRIPE_SECRET_KEY);
}

const lookupKey = (plan: PaidPlan) => `pickstall_${plan}_monthly`;
const PLAN_NAMES: Record<PaidPlan, string> = { starter: "Pickstall Starter", pro: "Pickstall Pro" };

function planOfLookupKey(key: string | null | undefined): PaidPlan | null {
  return PAID_PLANS.find((plan) => lookupKey(plan) === key) ?? null;
}

const priceCache = new Map<string, string>();

/**
 * The Stripe price for a plan at today's PLANNED_PRICE_CENTS, created on first use. The lookup key
 * stays the same; when our price changes, a new price takes the key over (`transfer_lookup_key`), so
 * existing subscribers keep their old price until they switch. Nothing to set up in the Dashboard.
 */
export async function ensurePlanPrice(plan: PaidPlan): Promise<string> {
  const amount = PLANNED_PRICE_CENTS[plan];
  const cacheKey = `${plan}:${amount}`;
  const cached = priceCache.get(cacheKey);
  if (cached) return cached;

  const stripe = stripeClient();
  const key = lookupKey(plan);
  const found = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  const current = found.data[0];
  if (current && current.unit_amount === amount && current.currency === "usd" && current.recurring?.interval === "month") {
    priceCache.set(cacheKey, current.id);
    return current.id;
  }
  const created = await stripe.prices.create(
    {
      currency: "usd",
      unit_amount: amount,
      recurring: { interval: "month" },
      lookup_key: key,
      transfer_lookup_key: true,
      // The product name is the description on invoices (India export rules ask for a clear one).
      product_data: { name: `${PLAN_NAMES[plan]} (monthly creator store subscription)` },
      metadata: { plan },
    },
    { idempotencyKey: `plan-price:${key}:${amount}` },
  );
  priceCache.set(cacheKey, created.id);
  return created.id;
}

/**
 * A Stripe Checkout page where the creator subscribes. India export rules need the customer's name and
 * billing address for cards issued outside India, so the address is required and saved on the customer.
 */
export async function createSubscriptionCheckout(input: {
  storeId: string;
  plan: PaidPlan;
  email: string;
  customerId: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const price = await ensurePlanPrice(input.plan);
  const session = await stripeClient().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.storeId,
    ...(input.customerId ? { customer: input.customerId, customer_update: { address: "auto", name: "auto" } } : { customer_email: input.email }),
    billing_address_collection: "required",
    metadata: { kind: "billing", store_id: input.storeId, plan: input.plan },
    subscription_data: { metadata: { store_id: input.storeId, plan: input.plan } },
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL.");
  return session.url;
}

/** Stripe's own page for changing the card, seeing invoices or cancelling. */
export async function createPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const session = await stripeClient().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return session.url;
}

function stateOf(subscription: Stripe.Subscription): SubscriptionState {
  const item = subscription.items.data[0];
  const customer = subscription.customer;
  return {
    subscriptionId: subscription.id,
    customerId: typeof customer === "string" ? customer : customer.id,
    storeId: subscription.metadata?.store_id ?? null,
    plan: planOfLookupKey(item?.price.lookup_key) ?? (PAID_PLANS.find((plan) => plan === subscription.metadata?.plan) ?? null),
    status: subscription.status,
    currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end || subscription.cancel_at !== null,
  };
}

/**
 * The subscription as Stripe has it now. Webhooks call this instead of trusting the event body, so
 * events that arrive twice or out of order always end in the latest state.
 */
export async function fetchSubscriptionState(subscriptionId: string): Promise<SubscriptionState> {
  return stateOf(await stripeClient().subscriptions.retrieve(subscriptionId));
}

/**
 * The subscription behind a finished Checkout, but only if that Checkout belongs to this store.
 * Used when the creator comes back from Stripe, so the plan page is right even before the webhook.
 */
export async function subscriptionOfCheckout(sessionId: string, storeId: string): Promise<SubscriptionState | null> {
  const session = await stripeClient().checkout.sessions.retrieve(sessionId);
  if (session.mode !== "subscription" || session.client_reference_id !== storeId || !session.subscription) return null;
  const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
  return fetchSubscriptionState(id);
}

/**
 * Moves a subscription to another plan. Prorations are added to the next invoice, so an upgrade costs
 * the difference for the rest of the month and a downgrade gives credit.
 */
export async function switchSubscriptionPlan(subscriptionId: string, plan: PaidPlan): Promise<SubscriptionState> {
  const stripe = stripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data[0];
  if (!item) throw new Error("Subscription has no item.");
  const price = await ensurePlanPrice(plan);
  const updated = await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: item.id, price }],
    proration_behavior: "create_prorations",
    metadata: { ...subscription.metadata, plan },
  });
  return stateOf(updated);
}
