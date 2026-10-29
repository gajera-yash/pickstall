import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/db/mongo";
import type { Currency, SocialLinkKind } from "@/lib/config";
import type { ThemePresetId } from "@/lib/themes";

// Document shapes of the app's own collections (D-024). Better Auth owns `user`, `session`,
// `account` and `verification`; app code never writes to those directly.
// IDs are UUID strings, timestamps are Date (UTC). There is no row-level security in MongoDB:
// every query on creator data MUST filter by the owner (see lib/stores/queries.ts).

/** Extra account details, keyed by the Better Auth user id. */
export type ProfileDoc = {
  _id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StoreDoc = {
  _id: string;
  ownerId: string;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  /**
   * Social links on the store page (D-028), https only, max 6. Missing on stores created before
   * the migration `scripts/migrations/2026-10-29-store-social-links.mjs`; readers fall back to `link`.
   */
  socialLinks?: { kind: SocialLinkKind; url: string }[];
  /** @deprecated Replaced by `socialLinks`. The migration copies it and removes it. Never write it. */
  link?: string | null;
  theme: { preset: ThemePresetId; accent: string };
  currency: Currency;
  /** Written only by the Stripe OAuth callback and the Connect webhook (Block D). */
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Signup details waiting for the email code (D-019). Removed by a TTL index after `expiresAt`. */
export type SignupIntentDoc = {
  _id: string;
  email: string;
  username: string;
  fullName: string;
  phone: string | null;
  tokenHash: string;
  attempts: number;
  windowStartedAt: Date;
  ipHash: string | null;
  createdAt: Date;
  expiresAt: Date;
};

/** Fixed-window rate-limit counter. Removed by a TTL index after `expiresAt`. */
export type RateLimitDoc = { _id: string; count: number; expiresAt: Date };

export async function collections(): Promise<{
  profiles: Collection<ProfileDoc>;
  stores: Collection<StoreDoc>;
  signupIntents: Collection<SignupIntentDoc>;
  rateLimits: Collection<RateLimitDoc>;
}> {
  const db = await getDb();
  return {
    profiles: db.collection<ProfileDoc>("profiles"),
    stores: db.collection<StoreDoc>("stores"),
    signupIntents: db.collection<SignupIntentDoc>("signupIntents"),
    rateLimits: db.collection<RateLimitDoc>("rateLimits"),
  };
}
