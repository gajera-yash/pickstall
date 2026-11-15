import "server-only";

import { collections } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { logger } from "@/lib/logger";
import type { SubscriptionState } from "@/lib/payments/billing";

// Store side of platform billing (D-073). `applySubscriptionState` is the only writer of
// stores.billing, and it is only fed with subscriptions fetched from Stripe (webhook or Checkout
// return), never with client input.

/** Statuses in which a subscription gives the store access (see lib/plans/access.ts). */
const GIVES_ACCESS = ["active", "trialing", "past_due"];

/** The owner's store id and billing ids, for the billing actions. Owner from the session. */
export async function billingOfOwner(ownerId: string): Promise<{ storeId: string; customerId: string | null; subscriptionId: string | null; status: string | null } | null> {
  const { stores } = await collections();
  const doc = await stores.findOne({ ownerId }, { projection: { _id: 1, billing: 1 } });
  if (!doc) return null;
  return { storeId: doc._id, customerId: doc.billing?.customerId ?? null, subscriptionId: doc.billing?.subscriptionId ?? null, status: doc.billing?.status ?? null };
}

export type ApplyResult = "applied" | "ignored" | "conflict";

/**
 * Saves a subscription on its store (from our own metadata). Guards:
 * - a store already linked to a Stripe customer only accepts that customer's subscriptions;
 * - a subscription that no longer gives access (an old, cancelled one arriving late) never replaces a
 *   different subscription that does.
 * Safe to call any number of times with the same state.
 */
export async function applySubscriptionState(state: SubscriptionState, now = new Date()): Promise<ApplyResult> {
  if (!state.storeId) return "ignored";
  const { stores } = await collections();

  const sameCustomer = { $or: [{ "billing.customerId": { $exists: false } }, { "billing.customerId": state.customerId }] };
  const conditions: Record<string, unknown>[] = [sameCustomer];
  if (!GIVES_ACCESS.includes(state.status)) {
    conditions.push({
      $or: [
        { billing: { $exists: false } },
        { "billing.subscriptionId": state.subscriptionId },
        { "billing.subscriptionId": null },
        { "billing.status": { $nin: GIVES_ACCESS } },
      ],
    });
  }

  try {
    const result = await stores.updateOne(
      { _id: state.storeId, $and: conditions },
      {
        $set: {
          billing: {
            customerId: state.customerId,
            subscriptionId: state.subscriptionId,
            plan: state.plan,
            status: state.status,
            currentPeriodEnd: state.currentPeriodEnd,
            cancelAtPeriodEnd: state.cancelAtPeriodEnd,
            updatedAt: now,
          },
          updatedAt: now,
        },
      },
    );
    return result.matchedCount === 1 ? "applied" : "ignored";
  } catch (error) {
    // This Stripe customer already belongs to another store.
    if (isDuplicateKeyError(error, "billing.customerId")) {
      logger.error("billing.customer_conflict", { storeId: state.storeId });
      return "conflict";
    }
    throw error;
  }
}
