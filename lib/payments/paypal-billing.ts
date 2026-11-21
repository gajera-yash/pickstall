import "server-only";

import { z } from "zod";

import { PAID_PLANS, PLANNED_PRICE_CENTS, type PaidPlan } from "@/lib/config";
import { PayPalApiError, paypalCall, type PayPalCredentials } from "@/lib/payments/paypal-api";
import { platformPayPal } from "@/lib/payments/paypal-config";
import { fromPayPalValue, toPayPalValue } from "@/lib/payments/paypal-money";
import type { PlanInvoiceState, SubscriptionState } from "@/lib/payments/billing";

// Platform billing with PayPal Subscriptions (D-118): creators pay Pickstall for a plan on OUR OWN
// PayPal app (PAYPAL_CLIENT_ID). Never a creator's app or money. The product and the monthly USD
// plans are created on first use and found again by name, so nothing has to be set up by hand; a
// new price gets a new plan name, and existing subscribers keep their old plan. Shapes checked
// against PayPal's OpenAPI files (billing_subscriptions_v1, catalogs_products_v1) on 2026-11-21.

const PRODUCT_ID = "PICKSTALL-PLANS";
const PLAN_LABEL: Record<PaidPlan, string> = { starter: "Starter", pro: "Pro" };
const SUBSCRIPTION_ID = /^I-[A-Z0-9]{6,40}$/;
const PLAN_ID = /^P-[A-Z0-9]{6,40}$/;

/** "Pickstall Starter monthly 1900 USD": the plan and price are read back from the name. */
export function planName(plan: PaidPlan, cents = PLANNED_PRICE_CENTS[plan]): string {
  return `Pickstall ${PLAN_LABEL[plan]} monthly ${cents} USD`;
}

/** Our plan and its monthly price from a PayPal plan name we made, or null. */
export function planOfName(name: string): { plan: PaidPlan; cents: number } | null {
  const match = /^Pickstall (Starter|Pro) monthly (\d{1,7}) USD$/.exec(name);
  if (!match) return null;
  const plan = PAID_PLANS.find((item) => PLAN_LABEL[item] === match[1]);
  return plan ? { plan, cents: Number(match[2]) } : null;
}

export function paypalBillingConfigured(): boolean {
  return platformPayPal() !== null;
}

function app(): PayPalCredentials {
  const platform = platformPayPal();
  if (!platform) throw new Error("PayPal billing is not configured.");
  return { mode: platform.mode, clientId: platform.clientId, secret: platform.secret };
}

const link = z.object({ href: z.string(), rel: z.string() }).loose();
const planSummary = z.object({ id: z.string().regex(PLAN_ID), name: z.string(), status: z.string().optional() }).loose();
const planList = z.object({ plans: z.array(planSummary).default([]), total_pages: z.number().optional() }).loose();
const money = z.object({ currency_code: z.string(), value: z.string() }).loose();
const subscription = z
  .object({
    id: z.string().regex(SUBSCRIPTION_ID),
    status: z.enum(["APPROVAL_PENDING", "APPROVED", "ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"]),
    plan_id: z.string(),
    custom_id: z.string().optional(),
    billing_info: z
      .object({
        next_billing_time: z.string().optional(),
        failed_payments_count: z.number().optional(),
        last_payment: z.object({ amount: money.optional(), time: z.string().optional() }).loose().optional(),
      })
      .loose()
      .optional(),
    links: z.array(link).default([]),
  })
  .loose();
const transactions = z
  .object({
    transactions: z
      .array(z.object({ id: z.string().min(1), status: z.string(), time: z.string(), amount_with_breakdown: z.object({ gross_amount: money }).loose() }).loose())
      .default([]),
  })
  .loose();

function approveLink(links: z.infer<typeof link>[]): string | null {
  const found = links.find((item) => item.rel === "approve");
  if (!found) return null;
  try {
    const url = new URL(found.href);
    return url.protocol === "https:" && /(^|\.)paypal\.com$/.test(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

/** Plan ids by name, cached for this server instance. */
const planIds = new Map<string, string>();

async function ensureProduct(credentials: PayPalCredentials): Promise<void> {
  try {
    await paypalCall(credentials, `/v1/catalogs/products/${PRODUCT_ID}`, { method: "GET" }, z.object({ id: z.string() }).loose());
  } catch (error) {
    if (!(error instanceof PayPalApiError && error.status === 404)) throw error;
    await paypalCall(
      credentials,
      "/v1/catalogs/products",
      { method: "POST", requestId: `product-${PRODUCT_ID}`, body: { id: PRODUCT_ID, name: "Pickstall plans", type: "SERVICE", description: "Pickstall creator store plans" } },
      z.object({ id: z.string() }).loose(),
    );
  }
}

/** The active PayPal plan for our plan at today's price, created on first use. */
export async function planIdFor(plan: PaidPlan): Promise<string> {
  const name = planName(plan);
  const cached = planIds.get(name);
  if (cached) return cached;
  const credentials = app();
  await ensureProduct(credentials);
  for (let page = 1; page <= 10; page++) {
    const list = await paypalCall(credentials, `/v1/billing/plans?product_id=${PRODUCT_ID}&page_size=20&page=${page}&total_required=true`, { method: "GET" }, planList);
    const found = list.plans.find((item) => item.name === name && (item.status ?? "ACTIVE") === "ACTIVE");
    if (found) {
      planIds.set(name, found.id);
      return found.id;
    }
    if (!list.total_pages || page >= list.total_pages) break;
  }
  const created = await paypalCall(
    credentials,
    "/v1/billing/plans",
    {
      method: "POST",
      requestId: `plan-${plan}-${PLANNED_PRICE_CENTS[plan]}`,
      body: {
        product_id: PRODUCT_ID,
        name,
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: { interval_unit: "MONTH", interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: { fixed_price: { currency_code: "USD", value: toPayPalValue(PLANNED_PRICE_CENTS[plan], "usd") } },
          },
        ],
        // Retry a failed payment up to 3 times before PayPal suspends the subscription.
        payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 },
      },
    },
    planSummary,
  );
  planIds.set(name, created.id);
  return created.id;
}

/** Our plan for a PayPal plan id (from its name), or null for a plan we did not make. */
async function planOfPlanId(credentials: PayPalCredentials, planId: string): Promise<{ plan: PaidPlan; cents: number } | null> {
  if (!PLAN_ID.test(planId)) return null;
  for (const [name, id] of planIds) if (id === planId) return planOfName(name);
  const found = await paypalCall(credentials, `/v1/billing/plans/${planId}`, { method: "GET" }, planSummary);
  planIds.set(found.name, found.id);
  return planOfName(found.name);
}

const addMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes()));

/**
 * A PayPal subscription in our SubscriptionState shape (the statuses lib/plans/access.ts knows).
 * Exported for unit tests. A cancelled subscription stays "active" (ending) until the month that was
 * already paid runs out, like Stripe's cancel at period end.
 */
export function stateOfSubscription(sub: z.infer<typeof subscription>, planInfo: { plan: PaidPlan; cents: number } | null, now = new Date()): SubscriptionState {
  const next = sub.billing_info?.next_billing_time ? new Date(sub.billing_info.next_billing_time) : null;
  const lastPaid = sub.billing_info?.last_payment?.time ? new Date(sub.billing_info.last_payment.time) : null;
  const paidUntil = lastPaid ? addMonth(lastPaid) : null;
  let status: string;
  let currentPeriodEnd: Date | null = next;
  let cancelAtPeriodEnd = false;
  switch (sub.status) {
    case "ACTIVE":
      status = (sub.billing_info?.failed_payments_count ?? 0) > 0 ? "past_due" : "active";
      break;
    case "APPROVAL_PENDING":
    case "APPROVED":
      status = "incomplete";
      break;
    case "SUSPENDED":
      status = "unpaid";
      break;
    case "CANCELLED":
      currentPeriodEnd = paidUntil;
      cancelAtPeriodEnd = true;
      status = paidUntil && paidUntil.getTime() > now.getTime() ? "active" : "canceled";
      break;
    default:
      status = "canceled";
      currentPeriodEnd = paidUntil;
  }
  return {
    subscriptionId: sub.id,
    // PayPal has no customer object: one stable id per store keeps the "one billing account per store" index.
    customerId: sub.custom_id ? `paypal:${sub.custom_id}` : `paypal:${sub.id}`,
    storeId: sub.custom_id ?? null,
    plan: planInfo?.plan ?? null,
    status,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    amountCents: planInfo?.cents ?? null,
    currency: planInfo ? "usd" : null,
    interval: planInfo ? "month" : null,
  };
}

async function fetchSubscription(credentials: PayPalCredentials, subscriptionId: string): Promise<z.infer<typeof subscription>> {
  if (!SUBSCRIPTION_ID.test(subscriptionId)) throw new Error("Not a PayPal subscription id.");
  return paypalCall(credentials, `/v1/billing/subscriptions/${subscriptionId}`, { method: "GET" }, subscription);
}

/** What PayPal says about a subscription now. */
export async function fetchPayPalSubscriptionState(subscriptionId: string): Promise<SubscriptionState> {
  const credentials = app();
  const sub = await fetchSubscription(credentials, subscriptionId);
  return stateOfSubscription(sub, await planOfPlanId(credentials, sub.plan_id));
}

/** Starts a subscription for a store and returns PayPal's approval page. `custom_id` is our store id. */
export async function createPayPalSubscription(input: { storeId: string; plan: PaidPlan; email: string; returnUrl: string; cancelUrl: string }): Promise<string> {
  const credentials = app();
  const sub = await paypalCall(
    credentials,
    "/v1/billing/subscriptions",
    {
      method: "POST",
      body: {
        plan_id: await planIdFor(input.plan),
        custom_id: input.storeId,
        ...(input.email ? { subscriber: { email_address: input.email } } : {}),
        application_context: { brand_name: "Pickstall", shipping_preference: "NO_SHIPPING", user_action: "SUBSCRIBE_NOW", return_url: input.returnUrl, cancel_url: input.cancelUrl },
      },
    },
    subscription,
  );
  const url = approveLink(sub.links);
  if (!url) throw new Error("PayPal did not return an approval link.");
  return url;
}

/**
 * Moves a subscription to another plan. PayPal asks the subscriber to approve the change, so this
 * returns its approval page (or null when no approval is needed and the change is already made).
 */
export async function revisePayPalSubscription(input: { subscriptionId: string; plan: PaidPlan; returnUrl: string; cancelUrl: string }): Promise<string | null> {
  if (!SUBSCRIPTION_ID.test(input.subscriptionId)) throw new Error("Not a PayPal subscription id.");
  const revised = await paypalCall(
    app(),
    `/v1/billing/subscriptions/${input.subscriptionId}/revise`,
    { method: "POST", body: { plan_id: await planIdFor(input.plan), application_context: { brand_name: "Pickstall", shipping_preference: "NO_SHIPPING", return_url: input.returnUrl, cancel_url: input.cancelUrl } } },
    z.object({ links: z.array(link).default([]) }).loose(),
  );
  return approveLink(revised.links);
}

/** Cancels a subscription (no more payments). Access stays until the paid month ends. */
export async function cancelPayPalSubscription(subscriptionId: string, reason: string): Promise<void> {
  if (!SUBSCRIPTION_ID.test(subscriptionId)) throw new Error("Not a PayPal subscription id.");
  await paypalCall(app(), `/v1/billing/subscriptions/${subscriptionId}/cancel`, { method: "POST", body: { reason: reason.slice(0, 128) } }, z.object({}).loose());
}

/** True when this subscription belongs to the given store (our custom_id). */
export async function payPalSubscriptionBelongsTo(subscriptionId: string, storeId: string): Promise<boolean> {
  const sub = await fetchSubscription(app(), subscriptionId);
  return sub.custom_id === storeId;
}

/** Completed plan payments of a subscription in the last `days` (for the admin's revenue, D-116). */
export async function payPalPlanPayments(state: SubscriptionState, now = new Date(), days = 40): Promise<PlanInvoiceState[]> {
  const start = new Date(now.getTime() - days * 86_400_000).toISOString();
  const end = now.toISOString();
  const list = await paypalCall(app(), `/v1/billing/subscriptions/${state.subscriptionId}/transactions?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`, { method: "GET" }, transactions);
  const payments: PlanInvoiceState[] = [];
  for (const txn of list.transactions) {
    if (txn.status !== "COMPLETED") continue;
    const gross = txn.amount_with_breakdown.gross_amount;
    const cents = fromPayPalValue(gross.value, gross.currency_code);
    if (cents === null) continue;
    payments.push({
      invoiceId: `paypal:${txn.id}`,
      customerId: state.customerId,
      subscriptionId: state.subscriptionId,
      storeId: state.storeId,
      plan: state.plan,
      amountPaidCents: cents,
      currency: gross.currency_code.toLowerCase(),
      paidAt: new Date(txn.time),
    });
  }
  return payments;
}

/** Where a subscriber manages or cancels PayPal automatic payments themselves. */
export function payPalAutopayUrl(): string {
  return platformPayPal()?.mode === "live" ? "https://www.paypal.com/myaccount/autopay/" : "https://www.sandbox.paypal.com/myaccount/autopay/";
}
