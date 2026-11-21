"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { appOrigin } from "@/lib/app-origin";
import { requireCreator } from "@/lib/auth/guards";
import { BILLING_RATE_LIMIT, PAID_PLANS, type PaidPlan } from "@/lib/config";
import { recordAudit } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { billingConfigured, createPortalSession, createSubscriptionCheckout, switchSubscriptionPlan } from "@/lib/payments/billing";
import { cancelPayPalSubscription, createPayPalSubscription, payPalAutopayUrl, paypalBillingConfigured, revisePayPalSubscription } from "@/lib/payments/paypal-billing";
import { activeProvider } from "@/lib/payments/paypal-config";
import { applySubscriptionState, billingOfOwner } from "@/lib/plans/billing-queries";
import { syncPayPalSubscription } from "@/lib/plans/paypal-billing";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";

// Settings > Plan buttons (D-073). Plain forms: each action ends in a redirect, back to the Plan page
// with `?billing=<outcome>` (a fixed list the page knows) or out to Stripe.

const PLAN_PATH = "/dashboard/settings/plan";
const back = (outcome: string): never => redirect(`${PLAN_PATH}?billing=${outcome}`);

function paidPlanOf(value: unknown): PaidPlan | null {
  return PAID_PLANS.find((plan) => plan === value) ?? null;
}

async function allowed(ownerId: string): Promise<boolean> {
  const { max, windowMinutes } = BILLING_RATE_LIMIT;
  return takeRateLimit(rateLimitKey("billing:owner", ownerId), max, windowMinutes);
}

const isPayPalSubscription = (id: string | null): id is string => Boolean(id && /^I-[A-Z0-9]{6,40}$/.test(id));

/**
 * PayPal plans (D-118): a new subscription opens PayPal's approval page; with a running PayPal
 * subscription it asks PayPal to move it to the other plan (the subscriber approves the change).
 */
async function startPayPalSubscription(user: { id: string; email: string | null }, access: { plan: PaidPlan | null }, plan: PaidPlan): Promise<never> {
  if (!paypalBillingConfigured()) back("unavailable");
  if (!(await allowed(user.id))) back("slow");
  let url: string | null = null;
  try {
    const billing = await billingOfOwner(user.id);
    if (!billing) back("error");
    const origin = await appOrigin();
    const cancelUrl = `${origin}${PLAN_PATH}?billing=cancelled`;
    if (access.plan && billing!.subscriptionId) {
      if (access.plan === plan) back("same_plan");
      // A plan still billed by Stripe from before the switch to PayPal cannot be moved here.
      if (!isPayPalSubscription(billing!.subscriptionId)) back("provider_changed");
      url = await revisePayPalSubscription({
        subscriptionId: billing!.subscriptionId!,
        plan,
        returnUrl: `${origin}/api/billing/paypal-return?subscription_id=${billing!.subscriptionId}`,
        cancelUrl,
      });
      await recordAudit({ actorId: user.id, storeId: billing!.storeId, action: "plan.changed", meta: { plan } });
      if (!url) {
        await syncPayPalSubscription(billing!.subscriptionId!);
        revalidatePath("/dashboard", "layout");
        back("switched");
      }
    } else {
      // PayPal adds ?subscription_id=... to the return link; the return route checks it is this store's.
      url = await createPayPalSubscription({ storeId: billing!.storeId, plan, email: user.email ?? "", returnUrl: `${origin}/api/billing/paypal-return`, cancelUrl });
      await recordAudit({ actorId: user.id, storeId: billing!.storeId, action: "plan.checkout_started", meta: { plan } });
    }
  } catch (error) {
    unstable_rethrow(error);
    logger.error("billing.paypal_subscribe_failed", { name: error instanceof Error ? error.name : undefined });
    back("error");
  }
  redirect(url!);
}

/** Opens the provider's page to subscribe to a plan. With a running subscription it switches plan instead. */
export async function startSubscription(planValue: string): Promise<void> {
  const { user, store } = await requireCreator(PLAN_PATH);
  const plan = paidPlanOf(planValue);
  if (!plan) back("error");
  if (activeProvider() === "paypal") await startPayPalSubscription(user, store.access, plan!);
  if (!billingConfigured()) back("unavailable");
  if (!(await allowed(user.id))) back("slow");

  let url: string;
  try {
    const billing = await billingOfOwner(user.id);
    if (!billing) back("error");
    if (billing!.subscriptionId && store.access.plan) {
      if (store.access.plan === plan) back("same_plan");
      await applySubscriptionState(await switchSubscriptionPlan(billing!.subscriptionId, plan!));
      await recordAudit({ actorId: user.id, storeId: billing!.storeId, action: "plan.changed", meta: { plan: plan! } });
      revalidatePath("/dashboard", "layout");
      back("switched");
    }
    const origin = await appOrigin();
    url = await createSubscriptionCheckout({
      storeId: billing!.storeId,
      plan: plan!,
      email: user.email ?? "",
      customerId: billing!.customerId,
      // Stripe fills in {CHECKOUT_SESSION_ID}; the return route checks it belongs to this store.
      successUrl: `${origin}/api/billing/return?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}${PLAN_PATH}?billing=cancelled`,
    });
    await recordAudit({ actorId: user.id, storeId: billing!.storeId, action: "plan.checkout_started", meta: { plan: plan! } });
  } catch (error) {
    unstable_rethrow(error); // redirects pass through
    logger.error("billing.subscribe_failed", { name: error instanceof Error ? error.name : undefined });
    back("error");
  }
  redirect(url!);
}

/** Stripe's portal (change the card, invoices, cancel), or PayPal's automatic payments page (D-118). */
export async function openBillingPortal(): Promise<void> {
  const { user } = await requireCreator(PLAN_PATH);
  if (activeProvider() === "paypal") {
    const billing = await billingOfOwner(user.id);
    if (!isPayPalSubscription(billing?.subscriptionId ?? null)) back("no_customer");
    redirect(payPalAutopayUrl());
  }
  if (!billingConfigured()) back("unavailable");
  if (!(await allowed(user.id))) back("slow");

  let url: string;
  try {
    const billing = await billingOfOwner(user.id);
    if (!billing?.customerId) back("no_customer");
    url = await createPortalSession(billing!.customerId!, `${await appOrigin()}${PLAN_PATH}`);
  } catch (error) {
    unstable_rethrow(error);
    logger.error("billing.portal_failed", { name: error instanceof Error ? error.name : undefined });
    back("error");
  }
  redirect(url!);
}

/** Cancels the PayPal plan (D-118). It stays active until the paid month ends, then the store pauses. */
export async function cancelPlan(): Promise<void> {
  const { user } = await requireCreator(PLAN_PATH);
  if (activeProvider() !== "paypal" || !paypalBillingConfigured()) back("unavailable");
  if (!(await allowed(user.id))) back("slow");
  try {
    const billing = await billingOfOwner(user.id);
    if (!billing || !isPayPalSubscription(billing.subscriptionId)) back("no_customer");
    await cancelPayPalSubscription(billing!.subscriptionId!, "Cancelled by the creator in Pickstall.");
    await syncPayPalSubscription(billing!.subscriptionId!);
    await recordAudit({ actorId: user.id, storeId: billing!.storeId, action: "plan.changed", meta: { plan: "cancelled" } });
    revalidatePath("/dashboard", "layout");
  } catch (error) {
    unstable_rethrow(error);
    logger.error("billing.paypal_cancel_failed", { name: error instanceof Error ? error.name : undefined });
    back("error");
  }
  back("plan_cancelled");
}
