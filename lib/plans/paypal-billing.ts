import "server-only";

import { z } from "zod";

import { recordAudit } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { fetchPayPalSubscriptionState, payPalPlanPayments } from "@/lib/payments/paypal-billing";
import type { SubscriptionState } from "@/lib/payments/billing";
import { applySubscriptionState, billingOfOwner } from "@/lib/plans/billing-queries";
import { savePlanPayment } from "@/lib/plans/payments";

// Keeps stores.billing in step with PayPal (D-118): from the verified webhook on our own app and from
// the return page after the creator approved a subscription. Only subscriptions fetched from PayPal
// are saved, never values from the browser.

async function saveState(state: SubscriptionState): Promise<void> {
  const result = await applySubscriptionState(state);
  if (result !== "applied") logger.info("billing.sync_skipped", { result });
  // Plan payments for the admin's revenue (D-116); each saved once by its PayPal transaction id.
  const payments = await payPalPlanPayments(state).catch((error: unknown) => {
    logger.warn("billing.paypal_payments_failed", { name: error instanceof Error ? error.name : undefined });
    return [];
  });
  for (const payment of payments) await savePlanPayment(payment);
}

/** A verified webhook named this subscription: save what PayPal says about it now. */
export async function syncPayPalSubscription(subscriptionId: string): Promise<void> {
  await saveState(await fetchPayPalSubscriptionState(subscriptionId));
}

const subscriptionId = z.string().regex(/^I-[A-Z0-9]{6,40}$/);

/** The creator is back from approving on PayPal. Returns the outcome for the Plan page. */
export async function syncPayPalReturn(ownerId: string, rawSubscriptionId: string | null): Promise<"success" | "pending" | "error"> {
  const parsed = subscriptionId.safeParse(rawSubscriptionId);
  if (!parsed.success) return "pending"; // no id in the link: the webhook still brings the plan in
  try {
    const billing = await billingOfOwner(ownerId);
    if (!billing) return "error";
    const state = await fetchPayPalSubscriptionState(parsed.data);
    // Only a subscription started for THIS store (our custom_id) is saved here.
    if (state.storeId !== billing.storeId) return "error";
    await saveState(state);
    const active = state.status === "active";
    if (active) await recordAudit({ actorId: ownerId, storeId: billing.storeId, action: "plan.subscribed", meta: { plan: state.plan ?? "unknown" } });
    return active ? "success" : "pending";
  } catch (error) {
    logger.error("billing.paypal_return_failed", { name: error instanceof Error ? error.name : undefined });
    return "pending";
  }
}
