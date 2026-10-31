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

export type CheckoutQuestionDoc = {
  id: string;
  label: string;
  kind: "text" | "long_text" | "dropdown" | "checkbox";
  required: boolean;
  options: string[];
};

/** A product (D-030). Phase 1 has one type, `digital`. Every query filters by `storeId` of the session owner. */
export type ProductDoc = {
  _id: string;
  storeId: string;
  type: "digital";
  title: string;
  /** Unique per store (index `products_store_slug_unique`). */
  slug: string;
  description: string | null;
  coverUrl: string | null;
  pricingModel: "fixed" | "pwyw";
  /** Fixed price, or the suggested price for pay-what-you-want. Integer cents. */
  priceCents: number;
  /** Pay-what-you-want minimum, integer cents. */
  minPriceCents: number | null;
  /** Never in public reads: delivered only after a verified payment. */
  externalUrl: string | null;
  buttonText: string | null;
  downloadLimit: number | null;
  status: "draft" | "published" | "archived";
  checkout: { headline: string | null; askPhone: boolean; questions: CheckoutQuestionDoc[] };
  afterPurchase: { thankYou: string | null; redirectUrl: string | null; emailSubject: string | null; emailBody: string | null };
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

/** One answer to a checkout question, with the label as it was when the buyer answered (D-033). */
export type OrderAnswerDoc = { questionId: string; label: string; value: string };

/** An order (D-033). Amounts are integer cents; they are computed on the server from the product, never from the client. */
export type OrderDoc = {
  _id: string;
  storeId: string;
  productId: string;
  /** What the buyer bought, frozen at checkout. Later edits to the product do not change the order. */
  item: { title: string; unitPriceCents: number };
  buyerEmail: string;
  buyerName: string;
  buyerPhone: string | null;
  answers: OrderAnswerDoc[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  status: "pending" | "paid" | "refunded" | "failed";
  /** Who takes the payment: Stripe, the development-only mock, or none for a free product. */
  provider: "stripe" | "mock" | "free";
  providerSessionId: string | null;
  createdAt: Date;
  paidAt: Date | null;
};

/** A provider webhook already handled. `_id` is the provider's event id, so a replay fails to insert (idempotency). */
export type WebhookEventDoc = { _id: string; source: string; type: string; orderId: string | null; processedAt: Date };

/** An uploaded image (D-032). The file itself is in file storage under `key`; images are public. */
export type UploadDoc = {
  _id: string;
  storeId: string;
  kind: "avatar" | "cover";
  mime: string;
  size: number;
  key: string;
  createdAt: Date;
};

/** Fixed-window rate-limit counter. Removed by a TTL index after `expiresAt`. */
export type RateLimitDoc = { _id: string; count: number; expiresAt: Date };

export async function collections(): Promise<{
  profiles: Collection<ProfileDoc>;
  stores: Collection<StoreDoc>;
  products: Collection<ProductDoc>;
  uploads: Collection<UploadDoc>;
  orders: Collection<OrderDoc>;
  webhookEvents: Collection<WebhookEventDoc>;
  signupIntents: Collection<SignupIntentDoc>;
  rateLimits: Collection<RateLimitDoc>;
}> {
  const db = await getDb();
  return {
    profiles: db.collection<ProfileDoc>("profiles"),
    stores: db.collection<StoreDoc>("stores"),
    products: db.collection<ProductDoc>("products"),
    uploads: db.collection<UploadDoc>("uploads"),
    orders: db.collection<OrderDoc>("orders"),
    webhookEvents: db.collection<WebhookEventDoc>("webhookEvents"),
    signupIntents: db.collection<SignupIntentDoc>("signupIntents"),
    rateLimits: db.collection<RateLimitDoc>("rateLimits"),
  };
}
