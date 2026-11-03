import "server-only";

import { randomUUID } from "node:crypto";

import { DEFAULT_CURRENCY } from "@/lib/config";
import { collections } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { logger } from "@/lib/logger";
import { storeNameFromUsername } from "@/lib/stores/store-name";
import { DEFAULT_THEME } from "@/lib/themes";

export type DraftStoreResult = "created" | "taken" | "has_store" | "error";

/**
 * Creates the user's draft (unpublished) store. `ownerId` must come from the verified session.
 * The unique indexes decide taken usernames and one store per user (lib/db/mongo.ts). The store
 * name starts as the username the creator picked (D-044).
 */
export async function createDraftStore(ownerId: string, username: string): Promise<DraftStoreResult> {
  const now = new Date();
  try {
    const { stores } = await collections();
    await stores.insertOne({
      _id: randomUUID(),
      ownerId,
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
    logger.error("stores.create_draft_failed", { name: error instanceof Error ? error.name : undefined });
    return "error";
  }
}
