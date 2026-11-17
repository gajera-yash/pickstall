"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { appOrigin } from "@/lib/app-origin";
import { requireCreator } from "@/lib/auth/guards";
import { BILLING_RATE_LIMIT, PAID_PLANS, type PaidPlan } from "@/lib/config";
import { recordAudit } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { billingConfigured, createPortalSession, createSubscriptionCheckout, switchSubscriptionPlan } from "@/lib/payments/billing";
import { applySubscriptionState, billingOfOwner } from "@/lib/plans/billing-queries";
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

/** Opens Stripe Checkout for a plan. With a running subscription it switches plan instead. */
export async function startSubscription(planValue: string): Promise<void> {
  const { user, store } = await requireCreator(PLAN_PATH);
  const plan = paidPlanOf(planValue);
  if (!plan) back("error");
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

/** Stripe's portal: change the card, see invoices, cancel. */
export async function openBillingPortal(): Promise<void> {
  const { user } = await requireCreator(PLAN_PATH);
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
