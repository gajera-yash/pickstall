import "server-only";

import { collections } from "@/lib/db/collections";
import { storeCanTakePayments } from "@/lib/payments/seller-status";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { storeAccess, type StoreAccess } from "@/lib/plans/access";
import type { PageDesignInput, SocialLink, StoreProfileInput } from "@/lib/stores/schemas";
import { socialLinksOf } from "@/lib/stores/social-links";
import type { StoreDesign } from "@/lib/store-design/rules";

export { socialLinksOf };

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
  theme: { preset: PageDesignInput["themePreset"]; accent: string; custom?: StoreDesign | null };
  stripeChargesEnabled: boolean;
  /** Connected Stripe account details (D-053), for Settings > Payments. Never sent to buyers. */
  stripe: { connected: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean };
  /**
   * True when buyers can pay this store with the active provider (PayPal by default, D-118). Use this,
   * not `stripeChargesEnabled`, for setup, publishing and checkout.
   */
  chargesEnabled: boolean;
  /** The connected PayPal app (D-118), for Settings > Payments: never the secret. */
  paypal: { connected: boolean; mode: "sandbox" | "live" | null; clientIdEnd: string | null };
  isPublished: boolean;
  /** Free trial, founding period or paused (D-072). Gate features with `can(store.access, ...)`. */
  access: StoreAccess;
  /** Store details saved at least once (D-091): setup step 1 is done. */
  profileSaved: boolean;
  /** A platform admin turned this store's broadcasts and welcome emails off (D-105). */
  broadcastsBlocked: boolean;
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
    socialLinks: socialLinksOf(doc),
    currency: doc.currency,
    theme: doc.theme,
    stripeChargesEnabled: doc.stripeChargesEnabled,
    stripe: {
      connected: doc.stripeAccountId !== null,
      // Stores connected before D-053 only have `stripeChargesEnabled`.
      payoutsEnabled: doc.stripePayoutsEnabled ?? doc.stripeChargesEnabled,
      detailsSubmitted: doc.stripeDetailsSubmitted ?? doc.stripeChargesEnabled,
    },
    chargesEnabled: storeCanTakePayments(doc),
    paypal: { connected: Boolean(doc.paypal), mode: doc.paypal?.mode ?? null, clientIdEnd: doc.paypal ? doc.paypal.clientId.slice(-6) : null },
    isPublished: doc.isPublished,
    access: storeAccess(doc),
    profileSaved: Boolean(doc.profileSavedAt),
    broadcastsBlocked: doc.broadcastsBlocked === true,
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
        // Saving the details finishes setup step 1, with or without a photo or bio (D-091).
        profileSavedAt: new Date(),
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
    // Dotted fields, so the creator's custom design (D-123) stays when the theme changes.
    { $set: { "theme.preset": input.themePreset, "theme.accent": input.accent, updatedAt: new Date() } },
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

export type StripeConnection = {
  accountId: string;
  livemode: boolean;
  status: { chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean };
};

/** A product buyers pay for: a price above 0 and no discount down to 0 (lib/products/pricing.ts). */
const PAID_PRODUCT = { priceCents: { $gt: 0 }, salePriceCents: { $ne: 0 } } as const;

/**
 * Sets the owner's Stripe seller account (D-053), or disconnects it with `null`. Disconnecting
 * unpublishes the store's paid products (PRD 5.6 A): they could not be bought any more. Returns
 * the account that was connected before (so the caller can deauthorize it), or false without a store.
 */
export async function setStoreStripeConnection(
  ownerId: string,
  connection: StripeConnection | null,
  options: { exclusive?: boolean } = {},
): Promise<{ previousAccountId: string | null } | false | "in_use"> {
  const { stores, products } = await collections();
  const now = new Date();
  const set = connection
    ? {
        stripeAccountId: connection.accountId,
        stripeChargesEnabled: connection.status.chargesEnabled,
        stripePayoutsEnabled: connection.status.payoutsEnabled,
        stripeDetailsSubmitted: connection.status.detailsSubmitted,
        stripeLivemode: connection.livemode,
        stripeConnectedAt: now,
        updatedAt: now,
      }
    : { stripeAccountId: null, stripeChargesEnabled: false, stripePayoutsEnabled: false, stripeDetailsSubmitted: false, stripeConnectedAt: null, updatedAt: now };
  // A real Connect account may belong to one store only (D-071): the claim key carries the unique
  // index. The test-mode shortcut (D-034) is not exclusive, and disconnecting always clears it.
  const update =
    connection && options.exclusive ? { $set: { ...set, stripeClaimKey: connection.accountId } } : { $set: set, $unset: { stripeClaimKey: "" as const } };
  let before;
  try {
    before = await stores.findOneAndUpdate({ ownerId }, update, { projection: { _id: 1, stripeAccountId: 1 } });
  } catch (error) {
    if (isDuplicateKeyError(error, "stripeClaimKey")) return "in_use";
    throw error;
  }
  if (!before) return false;
  if (!connection) await products.updateMany({ storeId: before._id, status: "published", ...PAID_PRODUCT }, { $set: { status: "draft", updatedAt: now } });
  return { previousAccountId: before.stripeAccountId };
}

/** How many OTHER stores sell through this Stripe account (then it must not be deauthorized). */
export async function countOtherStoresWithAccount(ownerId: string, accountId: string): Promise<number> {
  const { stores } = await collections();
  return stores.countDocuments({ stripeAccountId: accountId, ownerId: { $ne: ownerId } });
}

// The next two are called ONLY from a verified Stripe Connect webhook (lib/payments/process.ts):
// the account id comes from Stripe's signed event, not from a client, and selects the store(s).

/** Keeps a connected account's status fresh (account.updated). */
export async function applyStripeAccountStatus(accountId: string, status: StripeConnection["status"]): Promise<void> {
  const { stores } = await collections();
  await stores.updateMany(
    { stripeAccountId: accountId },
    { $set: { stripeChargesEnabled: status.chargesEnabled, stripePayoutsEnabled: status.payoutsEnabled, stripeDetailsSubmitted: status.detailsSubmitted, updatedAt: new Date() } },
  );
}

/** The creator removed Pickstall in their Stripe Dashboard: disconnect and unpublish paid products (PRD 5.6 A). */
export async function detachStripeAccount(accountId: string): Promise<void> {
  const { stores, products } = await collections();
  const affected = await stores.find({ stripeAccountId: accountId }, { projection: { _id: 1 } }).toArray();
  if (affected.length === 0) return;
  const ids = affected.map((store) => store._id);
  const now = new Date();
  await stores.updateMany(
    { _id: { $in: ids }, stripeAccountId: accountId },
    {
      $set: { stripeAccountId: null, stripeChargesEnabled: false, stripePayoutsEnabled: false, stripeDetailsSubmitted: false, stripeConnectedAt: null, updatedAt: now },
      $unset: { stripeClaimKey: "" },
    },
  );
  await products.updateMany({ storeId: { $in: ids }, status: "published", ...PAID_PRODUCT }, { $set: { status: "draft", updatedAt: now } });
}

/** The connected account of a store, for checks in the webhook path. */
export async function stripeAccountOfStore(storeId: string): Promise<string | null> {
  const { stores } = await collections();
  const doc = await stores.findOne({ _id: storeId }, { projection: { stripeAccountId: 1 } });
  return doc?.stripeAccountId ?? null;
}

/**
 * Publishes or unpublishes the owner's store page. Returns false if they have no store. The first
 * publish also sets `publishedAt` (D-119), in the same update; later ones keep the first date.
 */
export async function setStorePublished(ownerId: string, isPublished: boolean): Promise<boolean> {
  const { stores } = await collections();
  const now = new Date();
  const result = isPublished
    ? await stores.updateOne({ ownerId }, [{ $set: { isPublished: true, updatedAt: now, publishedAt: { $ifNull: ["$publishedAt", now] } } }])
    : await stores.updateOne({ ownerId }, { $set: { isPublished: false, updatedAt: now } });
  return result.matchedCount === 1;
}

/** Saves the creator's custom design (D-123, already validated) on the owner's store, or removes it with null. */
export async function updateStoreDesign(ownerId: string, design: StoreDesign | null): Promise<boolean> {
  const { stores } = await collections();
  const result = await stores.updateOne({ ownerId }, { $set: { "theme.custom": design, updatedAt: new Date() } });
  return result.matchedCount === 1;
}
