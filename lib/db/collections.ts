import "server-only";
import type { RichDoc } from "@/lib/products/rich-text";

import type { Collection } from "mongodb";

import { getDb } from "@/lib/db/mongo";
import type { Currency, SocialLinkKind } from "@/lib/config";
import type { CourseCategory } from "@/lib/courses/settings";
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
  /** Stripe account status from Connect (Block D, D-053). Optional: missing on stores connected before D-053. */
  stripePayoutsEnabled?: boolean;
  stripeDetailsSubmitted?: boolean;
  /** True when the account was connected with a live key. Events in the other mode are ignored. */
  stripeLivemode?: boolean;
  stripeConnectedAt?: Date | null;
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
/** A course's own settings (course flow G1, D-054). Only on products with type "course". */
export type CourseSettingsDoc = {
  category: CourseCategory | null;
  /** Up to 5 short tags, cleaned, unique ignoring case. */
  tags: string[];
  /** How long a buyer keeps access after buying, in days; null is lifetime. */
  accessDays: number | null;
  /** Drip (D-056): modules open on their own day after purchase. Missing or false: all open at once. */
  drip?: boolean;
};

export type ProductDoc = {
  _id: string;
  storeId: string;
  /** "digital" (Phase 1) or "course" (course flow, D-054). */
  type: "digital" | "course";
  /** Course settings, only when type is "course". */
  course?: CourseSettingsDoc;
  title: string;
  /** Unique per store (index `products_store_slug_unique`). */
  slug: string;
  /** Plain text of the description (cards, meta, search). Derived from descriptionDoc on save. */
  description: string | null;
  /** The description as allow-listed rich text (D-049); missing on products saved before it. */
  descriptionDoc?: RichDoc | null;
  coverUrl: string | null;
  /** Regular price, in Stripe amount units for the store currency (D-046). 0 is free. */
  priceCents: number;
  /** Discounted price buyers pay instead (D-047), lower than priceCents; null without a discount. */
  salePriceCents: number | null;
  /**
   * Pay-what-you-want fields from before D-047. No longer written or read; the migration
   * `scripts/migrations/2026-11-remove-pwyw.mjs` removes them. Until then such a product sells at
   * priceCents (its old suggested price).
   */
  pricingModel?: "fixed" | "pwyw";
  minPriceCents?: number | null;
  /** Never in public reads: delivered only after a verified payment. */
  externalUrl: string | null;
  /**
   * How buyers get the product (D-050): a link (externalUrl) or an uploaded file (fileId). Missing
   * on products saved before it, which are links.
   */
  deliveryType?: "link" | "file";
  /** The uploaded file in `files` when deliveryType is "file". Never in public reads. */
  fileId?: string | null;
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
  /** The provider's payment id, saved when the order is paid; a refund event finds the order through it. */
  providerPaymentId?: string | null;
  /** Refunds (D-053). Only the verified refund webhook sets `refundedAt` and `amountRefundedCents`. */
  refundRequestedAt?: Date | null;
  refundedAt?: Date | null;
  /** Stripe amount units refunded so far; a partial refund keeps the order paid (and access). */
  amountRefundedCents?: number;
  /** How many times the buyer opened the delivery link (R7), checked against the product's download limit. */
  accessCount?: number;
  createdAt: Date;
  paidAt: Date | null;
};

/** A provider webhook already handled. `_id` is the provider's event id, so a replay fails to insert (idempotency). */
export type WebhookEventDoc = { _id: string; source: string; type: string; orderId: string | null; processedAt: Date };

/**
 * The unique link in a buyer's order email (D-037). Only the SHA-256 of the token is stored. The link
 * lets the buyer create a password for the email they paid with (the email itself proves they own it).
 */
export type AccessTokenDoc = {
  /** SHA-256 hex of the token in the link. */
  _id: string;
  orderId: string;
  email: string;
  name: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  /** The TTL index removes the document at this time. */
  deleteAt: Date;
};

/** One email to send per order and kind. `_id` is `<orderId>:<kind>`, so a replayed event cannot send it twice. */
export type EmailOutboxDoc = {
  _id: string;
  orderId: string;
  kind: "order-confirmation";
  status: "sending" | "sent" | "failed";
  attempts: number;
  createdAt: Date;
  sentAt: Date | null;
};

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

/**
 * A product file buyers download (D-050). Kept in private storage under `key` (a uuid); `name` is
 * the cleaned name buyers download as, `mime` comes from the detected type. Every read filters by
 * `storeId` from the session or from the buyer's paid order.
 */
export type FileDoc = {
  _id: string;
  storeId: string;
  productId: string;
  /** Set on a course lesson's attachment (D-055); missing on a digital product's file. */
  lessonId?: string;
  key: string;
  name: string;
  ext: string;
  mime: string;
  size: number;
  createdAt: Date;
};

/**
 * A pending Stripe Connect OAuth start (D-053). `_id` is the random `state` sent to Stripe; it is
 * bound to the user who started it, used once (deleted before the code is exchanged) and removed by
 * a TTL index after `expiresAt`.
 */
export type ConnectStateDoc = { _id: string; userId: string; returnTo: "settings" | "setup"; createdAt: Date; expiresAt: Date };

/** A module of a course (D-055): an ordered group of lessons. `productId` is the course. */
export type CourseModuleDoc = {
  _id: string;
  storeId: string;
  productId: string;
  title: string;
  sortOrder: number;
  /** Drip (G3): days after purchase when the module unlocks; null opens it right away. */
  dripDays: number | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * A lesson's video (D-055): uploaded to Bunny Stream (status kept fresh by the verified Bunny
 * webhook), or a YouTube / Vimeo video kept as its id only. Never in public reads.
 */
export type LessonVideoDoc =
  | { kind: "bunny"; videoId: string; status: "uploading" | "processing" | "ready" | "failed" }
  | { kind: "youtube"; id: string }
  | { kind: "vimeo"; id: string; hash: string | null };

/** An extra link on a lesson (a Figma file, a doc), https only. */
export type LessonLinkDoc = { label: string; url: string };

/** A lesson of a course module (D-055). Content is never public: students get it after access checks (G4). */
export type LessonDoc = {
  _id: string;
  storeId: string;
  productId: string;
  moduleId: string;
  title: string;
  sortOrder: number;
  video: LessonVideoDoc | null;
  /** Written notes, as allow-listed rich text (D-049). */
  bodyDoc: RichDoc | null;
  links: LessonLinkDoc[];
  createdAt: Date;
  updatedAt: Date;
};

/**
 * A lesson a student marked complete (D-057). `_id` is "orderId:lessonId", so marking twice is one
 * document. Progress belongs to the order, which belongs to the buyer's verified email.
 */
export type LessonProgressDoc = { _id: string; orderId: string; storeId: string; productId: string; lessonId: string; completedAt: Date };

/** Fixed-window rate-limit counter. Removed by a TTL index after `expiresAt`. */
export type RateLimitDoc = { _id: string; count: number; expiresAt: Date };

export async function collections(): Promise<{
  profiles: Collection<ProfileDoc>;
  stores: Collection<StoreDoc>;
  products: Collection<ProductDoc>;
  uploads: Collection<UploadDoc>;
  files: Collection<FileDoc>;
  orders: Collection<OrderDoc>;
  accessTokens: Collection<AccessTokenDoc>;
  emailOutbox: Collection<EmailOutboxDoc>;
  webhookEvents: Collection<WebhookEventDoc>;
  signupIntents: Collection<SignupIntentDoc>;
  rateLimits: Collection<RateLimitDoc>;
  connectStates: Collection<ConnectStateDoc>;
  courseModules: Collection<CourseModuleDoc>;
  lessons: Collection<LessonDoc>;
  lessonProgress: Collection<LessonProgressDoc>;
}> {
  const db = await getDb();
  return {
    profiles: db.collection<ProfileDoc>("profiles"),
    stores: db.collection<StoreDoc>("stores"),
    products: db.collection<ProductDoc>("products"),
    uploads: db.collection<UploadDoc>("uploads"),
    files: db.collection<FileDoc>("files"),
    orders: db.collection<OrderDoc>("orders"),
    accessTokens: db.collection<AccessTokenDoc>("accessTokens"),
    emailOutbox: db.collection<EmailOutboxDoc>("emailOutbox"),
    webhookEvents: db.collection<WebhookEventDoc>("webhookEvents"),
    signupIntents: db.collection<SignupIntentDoc>("signupIntents"),
    rateLimits: db.collection<RateLimitDoc>("rateLimits"),
    connectStates: db.collection<ConnectStateDoc>("connectStates"),
    courseModules: db.collection<CourseModuleDoc>("courseModules"),
    lessons: db.collection<LessonDoc>("lessons"),
    lessonProgress: db.collection<LessonProgressDoc>("lessonProgress"),
  };
}
