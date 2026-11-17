import "server-only";

import { randomUUID } from "node:crypto";

import { deletedAccountKey } from "@/lib/account/deleted-key";
import { canonicalEmail } from "@/lib/auth/email-rules";
import { collections } from "@/lib/db/collections";
import { recordAudit } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { cancelSubscriptionNow } from "@/lib/payments/billing";
import { releaseAccount } from "@/lib/stores/stripe-connect";
import { setStoreStripeConnection } from "@/lib/stores/queries";

// Account deletion (D-074). Better Auth calls `prepareAccountDeletion` from its `beforeDelete` hook,
// only after it has checked the signed-in session is fresh; then it deletes the user and all sessions.
// Throwing here stops the deletion, so nothing is left half done when Stripe cannot be reached.

/** Thrown when the deletion must not go ahead; the message is safe to show. */
export class AccountDeletionBlocked extends Error {}

const GIVES_ACCESS = ["active", "trialing", "past_due"];

/**
 * Cleans up everything of this user before Better Auth deletes the account:
 * - a running paid plan is cancelled at Stripe right away (no charges after deletion);
 * - Stripe Connect is disconnected;
 * - the store is unpublished and anonymised (name, bio, photo, links), its username is freed, and its
 *   products are unpublished. Products stay stored so buyers keep what they paid for, and orders stay
 *   for tax records (Privacy Policy);
 * - the profile (name, phone) is deleted;
 * - a one-way hash of the email is kept so a new store does not get another free trial.
 */
export async function prepareAccountDeletion(user: { id: string; email: string | null }, now = new Date()): Promise<void> {
  const { stores, products, profiles, deletedAccounts } = await collections();
  const store = await stores.findOne({ ownerId: user.id }, { projection: { _id: 1, billing: 1, stripeAccountId: 1 } });

  if (store) {
    const subscriptionId = store.billing?.subscriptionId;
    if (subscriptionId && GIVES_ACCESS.includes(store.billing?.status ?? "")) {
      try {
        await cancelSubscriptionNow(subscriptionId);
      } catch (error) {
        logger.error("account.delete_cancel_failed", { name: error instanceof Error ? error.name : undefined });
        throw new AccountDeletionBlocked("We couldn't cancel your plan with Stripe, so your account was not deleted. Please try again in a few minutes.");
      }
    }

    if (store.stripeAccountId) {
      const disconnected = await setStoreStripeConnection(user.id, null);
      if (disconnected && disconnected !== "in_use" && disconnected.previousAccountId) await releaseAccount(user.id, disconnected.previousAccountId);
    }

    await stores.updateOne(
      { _id: store._id, ownerId: user.id },
      {
        $set: {
          slug: `deleted-${randomUUID().slice(0, 12)}`,
          name: "Deleted store",
          bio: null,
          avatarUrl: null,
          socialLinks: [],
          isPublished: false,
          deletedAt: now,
          updatedAt: now,
        },
        // Free the inbox and Stripe keys (D-071) so the person can start again later.
        $unset: { ownerEmailKey: "", stripeClaimKey: "", link: "" },
      },
    );
    await products.updateMany({ storeId: store._id, status: "published" }, { $set: { status: "draft", updatedAt: now } });
  }

  await profiles.deleteOne({ _id: user.id });

  const key = user.email ? canonicalEmail(user.email) : null;
  if (key) await deletedAccounts.updateOne({ _id: deletedAccountKey(key) }, { $set: { deletedAt: now } }, { upsert: true });
  await recordAudit({ actorId: user.id, storeId: store?._id ?? null, action: "account.deleted" });
  logger.info("account.deleted", { hadStore: Boolean(store) });
}
