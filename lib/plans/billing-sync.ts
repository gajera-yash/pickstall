import "server-only";

import { z } from "zod";

import { recordAudit } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { fetchPlanInvoice, fetchSubscriptionState, listPaidPlanInvoices, subscriptionOfCheckout } from "@/lib/payments/billing";
import { applySubscriptionState, billingOfOwner } from "@/lib/plans/billing-queries";
import { savePlanPayment } from "@/lib/plans/payments";

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

/** Saves a paid plan invoice named by a verified webhook (D-116). Safe to repeat. */
export async function recordPlanInvoice(invoiceId: string): Promise<void> {
  const state = await fetchPlanInvoice(invoiceId);
  if (state) await savePlanPayment(state);
}

/** The admin's one-time import of paid plan invoices from Stripe (D-116). Returns how many were new. */
export async function importPlanInvoices(): Promise<{ seen: number; added: number }> {
  const invoices = await listPaidPlanInvoices();
  let added = 0;
  for (const invoice of invoices) if (await savePlanPayment(invoice)) added += 1;
  return { seen: invoices.length, added };
}
