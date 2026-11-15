import "server-only";

import { randomUUID } from "node:crypto";

import { deletedAccountKey } from "@/lib/account/deleted-key";
import { canonicalEmail } from "@/lib/auth/email-rules";
import { DEFAULT_CURRENCY } from "@/lib/config";
import { collections } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { logger } from "@/lib/logger";
import { trialEndFrom } from "@/lib/plans/access";
import { storeNameFromUsername } from "@/lib/stores/store-name";
import { DEFAULT_THEME } from "@/lib/themes";

export type DraftStoreResult = "created" | "taken" | "has_store" | "email_used" | "error";

/**
 * Creates the user's draft (unpublished) store. `ownerId` must come from the verified session.
 * The unique indexes decide taken usernames, one store per user and one store per inbox
 * (lib/db/mongo.ts, D-071). Call checkNewStore first for a clear message. The store name starts as
 * the username the creator picked (D-044).
 */
export async function createDraftStore(ownerId: string, username: string, ownerEmail: string): Promise<DraftStoreResult> {
  const now = new Date();
  const ownerEmailKey = canonicalEmail(ownerEmail);
  try {
    const { stores, deletedAccounts } = await collections();
    // The same person had a store before and deleted it: no second free trial (D-074).
    const returning = ownerEmailKey ? (await deletedAccounts.findOne({ _id: deletedAccountKey(ownerEmailKey) }, { projection: { _id: 1 } })) !== null : false;
    await stores.insertOne({
      _id: randomUUID(),
      ownerId,
      ...(ownerEmailKey ? { ownerEmailKey } : {}),
      // Every new store starts with the free trial (D-072).
      planTier: "trial",
      trialEndsAt: returning ? now : trialEndFrom(now),
      slug: username,
      name: storeNameFromUsername(username),
      bio: null,
      avatarUrl: null,
      socialLinks: [],
      theme: { ...DEFAULT_THEME },
      currency: DEFAULT_CURRENCY,
      stripeAccountId: null,
      stripeChargesEnabled: false,
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    });
    return "created";
  } catch (error) {
    if (isDuplicateKeyError(error, "ownerId")) return "has_store";
    if (isDuplicateKeyError(error, "slug")) return "taken";
    if (isDuplicateKeyError(error, "ownerEmailKey")) return "email_used";
    logger.error("stores.create_draft_failed", { name: error instanceof Error ? error.name : undefined });
    return "error";
  }
}
