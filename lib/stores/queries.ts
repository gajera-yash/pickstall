import "server-only";

import { collections } from "@/lib/db/collections";
import type { StoreSetupInput } from "@/lib/stores/schemas";

// Store reads and writes for the signed-in creator. MongoDB has no row-level security, so the
// owner filter here IS the access check: every function takes the owner id from the verified
// session (never from the client) and filters on it.

export type CreatorStore = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  link: string | null;
  currency: StoreSetupInput["currency"];
  theme: { preset: StoreSetupInput["themePreset"]; accent: string };
  stripeChargesEnabled: boolean;
  isPublished: boolean;
};

/** The store owned by this user, or null. */
export async function findStoreByOwner(ownerId: string): Promise<CreatorStore | null> {
  const { stores } = await collections();
  const doc = await stores.findOne({ ownerId });
  if (!doc) return null;
  return {
    id: doc._id,
    slug: doc.slug,
    name: doc.name,
    bio: doc.bio,
    avatarUrl: doc.avatarUrl,
    link: doc.link,
    currency: doc.currency,
    theme: doc.theme,
    stripeChargesEnabled: doc.stripeChargesEnabled,
    isPublished: doc.isPublished,
  };
}

/** Saves the store setup form on the owner's store. Returns false if they have no store. */
export async function updateStoreSetup(ownerId: string, input: StoreSetupInput): Promise<boolean> {
  const { stores } = await collections();
  const result = await stores.updateOne(
    { ownerId },
    {
      $set: {
        name: input.name,
        bio: input.bio ?? null,
        avatarUrl: input.avatarUrl ?? null,
        link: input.link ?? null,
        currency: input.currency,
        theme: { preset: input.themePreset, accent: input.accent },
        updatedAt: new Date(),
      },
    },
  );
  return result.matchedCount === 1;
}
