import "server-only";

import { collections, type StoreDoc } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import type { PageDesignInput, SocialLink, StoreProfileInput } from "@/lib/stores/schemas";

// Store reads and writes for the signed-in creator. MongoDB has no row-level security, so the
// owner filter here IS the access check: every function takes the owner id from the verified
// session (never from the client) and filters on it.

export type CreatorStore = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  socialLinks: SocialLink[];
  currency: StoreProfileInput["currency"];
  theme: { preset: PageDesignInput["themePreset"]; accent: string };
  stripeChargesEnabled: boolean;
  isPublished: boolean;
};

/** Social links, with the old single `link` as a website link until the migration has run. */
export function socialLinksOf(doc: Pick<StoreDoc, "socialLinks" | "link">): SocialLink[] {
  if (doc.socialLinks) return doc.socialLinks;
  return doc.link ? [{ kind: "website", url: doc.link }] : [];
}

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
    socialLinks: socialLinksOf(doc),
    currency: doc.currency,
    theme: doc.theme,
    stripeChargesEnabled: doc.stripeChargesEnabled,
    isPublished: doc.isPublished,
  };
}

/** Saves the store setup form on the owner's store. Returns false if they have no store. */
export async function updateStoreProfile(ownerId: string, input: StoreProfileInput): Promise<boolean> {
  const { stores } = await collections();
  const result = await stores.updateOne(
    { ownerId },
    {
      $set: {
        name: input.name,
        bio: input.bio ?? null,
        avatarUrl: input.avatarUrl ?? null,
        currency: input.currency,
        socialLinks: input.socialLinks,
        updatedAt: new Date(),
      },
      // The old single link now lives in socialLinks (D-028).
      $unset: { link: "" },
    },
  );
  return result.matchedCount === 1;
}

/** Saves the Page design tab (theme and accent) on the owner's store. Returns false if they have no store. */
export async function updateStorePageDesign(ownerId: string, input: PageDesignInput): Promise<boolean> {
  const { stores } = await collections();
  const result = await stores.updateOne(
    { ownerId },
    { $set: { theme: { preset: input.themePreset, accent: input.accent }, updatedAt: new Date() } },
  );
  return result.matchedCount === 1;
}

export type ChangeSlugResult = "changed" | "taken" | "no_store";

/**
 * Changes the owner's username (store slug). No check-then-update: the unique index
 * `stores_slug_unique` is the only authority, so a taken name fails the update itself.
 * The old link stops working at once (PRD F8, Phase 1). `slug` must already be validated.
 */
export async function changeStoreSlug(ownerId: string, slug: string): Promise<ChangeSlugResult> {
  const { stores } = await collections();
  try {
    const result = await stores.updateOne({ ownerId }, { $set: { slug, updatedAt: new Date() } });
    return result.matchedCount === 1 ? "changed" : "no_store";
  } catch (error) {
    if (isDuplicateKeyError(error, "slug")) return "taken";
    throw error;
  }
}
