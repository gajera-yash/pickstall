import "server-only";

import { z } from "zod";

import { recordAudit } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { fetchSubscriptionState, subscriptionOfCheckout } from "@/lib/payments/billing";
import { applySubscriptionState, billingOfOwner } from "@/lib/plans/billing-queries";

// Keeps stores.billing in step with Stripe (D-073): from the webhook and from the Checkout return.

/** A verified webhook named this subscription: save what Stripe says about it now. */
export async function syncSubscription(subscriptionId: string): Promise<void> {
  const state = await fetchSubscriptionState(subscriptionId);
  const result = await applySubscriptionState(state);
  if (result !== "applied") logger.info("billing.sync_skipped", { result });
}

const sessionId = z.string().regex(/^cs_(test|live)_[A-Za-z0-9]{10,200}$/);

/** The creator is back from Checkout. Returns the outcome for the Plan page. */
export async function syncCheckoutReturn(ownerId: string, rawSessionId: string | null): Promise<"success" | "pending" | "error"> {
  const parsed = sessionId.safeParse(rawSessionId);
  if (!parsed.success) return "error";
  try {
    const billing = await billingOfOwner(ownerId);
    if (!billing) return "error";
    const state = await subscriptionOfCheckout(parsed.data, billing.storeId);
    if (!state) return "error";
    await applySubscriptionState(state);
    const active = state.status === "active" || state.status === "trialing";
    if (active) await recordAudit({ actorId: ownerId, storeId: billing.storeId, action: "plan.subscribed", meta: { plan: state.plan ?? "unknown" } });
    return active ? "success" : "pending";
  } catch (error) {
    logger.error("billing.return_failed", { name: error instanceof Error ? error.name : undefined });
    return "pending"; // the webhook will still bring the plan in
  }
}
