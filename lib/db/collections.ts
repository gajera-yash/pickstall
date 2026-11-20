import "server-only";
import type { PageBlock } from "@/lib/page-blocks/rules";
import type { RichDoc } from "@/lib/products/rich-text";

import type { Binary, Collection } from "mongodb";

import { getDb } from "@/lib/db/mongo";
import type { Currency, SocialLinkKind } from "@/lib/config";
import type { CourseCategory } from "@/lib/courses/settings";
import type { ThemePresetId } from "@/lib/themes";

// Document shapes of the app's own collections (D-024). Better Auth owns `user`, `session`,
// `account` and `verification`; app code never writes to those directly.
// IDs are UUID strings, timestamps are Date (UTC). There is no row-level security in MongoDB:
// every query on creator data MUST filter by the owner (see lib/stores/queries.ts).

/** A store's subscription to a paid plan (D-073). `status` is Stripe's subscription status. */
export type StoreBilling = {
  customerId: string;
  subscriptionId: string | null;
  plan: "starter" | "pro" | null;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /** The plan's price per period from Stripe (D-116), for the admin MRR. Missing before D-116. */
  amountCents?: number | null;
  currency?: string | null;
  interval?: "day" | "week" | "month" | "year" | null;
  updatedAt: Date;
};

/**
 * A paid plan invoice (D-116): money a creator paid Pickstall for a plan, on our own Stripe account.
 * `_id` is the Stripe invoice id, so the webhook and the import never save one twice.
 */
export type PlanPaymentDoc = {
  _id: string;
  storeId: string | null;
  customerId: string;
  subscriptionId: string | null;
  plan: "starter" | "pro" | null;
  amountCents: number;
  currency: string;
  paidAt: Date;
  createdAt: Date;
};

/** Extra account details, keyed by the Better Auth user id. */
export type ProfileDoc = {
  _id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  /** The Terms version accepted before the store was created, and when (D-074). Missing for older accounts. */
  termsVersion?: string;
  termsAcceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type StoreDoc = {
  _id: string;
  ownerId: string;
  /**
   * The owner's email as one key per inbox (`canonicalEmail`, D-071): one store, and one free trial,
   * per person. Unique index `stores_owner_email_unique`. Missing on stores created before D-071
   * until `scripts/migrations/2026-11-15-store-identity-keys.mjs` has run.
   */
  ownerEmailKey?: string;
  /** When the creator first saved Store details (D-091): setup step 1 is done then, photo and bio being optional. */
  profileSavedAt?: Date | null;
  /**
   * The email sent once to each new subscriber (D-095). Missing: off. Creator text, sanitized and
   * length-limited; the footer with the store name and unsubscribe link is always added.
   */
  welcomeEmail?: { enabled: boolean; subject: string; body: string } | null;
  /**
   * One reminder to buyers who started a paid checkout and did not finish (D-096). Missing: off.
   * Empty subject or body: the default text. The checkout button and store name are always added.
   */
  abandonedCart?: { enabled: boolean; subject: string; body: string } | null;
  /**
   * One "please review" email a week after each paid order (D-117). Missing: off. Empty subject or
   * body: the default text. The review button and store name are always added.
   */
  reviewRequest?: { enabled: boolean; subject: string; body: string } | null;
  /**
   * Ad and analytics pixels on the store's own pages (D-097): IDs only, put into our fixed
   * snippets, loaded only after the visitor accepts. Never creator scripts. Missing: none.
   */
  pixels?: { metaPixelId: string | null; googleTagId: string | null } | null;
  /**
   * Store page sections around the products (D-101): text, image, video, links, testimonials and
   * the one "products" marker. Missing or empty: the page as before. Validated by lib/page-blocks.
   */
  pageBlocks?: PageBlock[] | null;
  /**
   * Set by a platform admin (D-105): the store is hidden and cannot sell or publish until restored.
   * Missing or null: not suspended. The reason is internal (never shown to buyers).
   */
  suspendedAt?: Date | null;
  suspendReason?: string | null;
  /** Set by a platform admin (D-105): no broadcasts or welcome emails from this store. */
  broadcastsBlocked?: boolean;
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
  /**
   * The connected Stripe account id, set only for a real Connect OAuth connection (D-071): one Stripe
   * account per store (unique index `stores_stripe_claim_unique`). Not set for the test-mode shortcut
   * (D-034), where several stores may use the founder's own account.
   */
  stripeClaimKey?: string;
  /**
   * Plan and free trial (D-072). New stores start as `trial` with `trialEndsAt` = created + TRIAL_DAYS.
   * `founding` is granted by the founder (scripts/admin/grant-founding.mjs) until `foundingEndsAt`.
   * Missing on stores created before D-072 until `scripts/migrations/2026-11-15-store-trials.mjs` ran;
   * such stores count as an open trial without an end. Paid plans arrive with billing (Phase C).
   */
  planTier?: "trial" | "founding";
  trialEndsAt?: Date;
  foundingEndsAt?: Date | null;
  /**
   * The paid plan (D-073), written ONLY from Stripe's verified data (webhooks on the platform account,
   * or a subscription fetched from Stripe). Never sent to buyers. `customerId` is unique per store.
   */
  billing?: StoreBilling;
  /** Set when the owner deleted their account (D-074): the store is anonymised and unpublished. */
  deletedAt?: Date;
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
  /** Certificates (D-111): students who finish every lesson can get one. Missing or false: off. */
  certificate?: boolean;
};

/** One weekly time range when a coach takes calls (D-081). Times are "HH:MM" in the product's time zone. */
export type CoachingWindowDoc = {
  /** ISO weekday: 1 Monday ... 7 Sunday. */
  day: number;
  start: string;
  end: string;
};

/** A coaching call's own settings (D-081). Only on products with type "coaching". */
export type CoachingSettingsDoc = {
  /** Length of one call in minutes (COACHING_DURATIONS). */
  durationMinutes: number;
  /** IANA time zone of the weekly hours, for example "Asia/Kolkata"; null until the creator saves. */
  timeZone: string | null;
  /** Weekly hours, at most 3 ranges a day, never overlapping. */
  weekly: CoachingWindowDoc[];
  /** Free minutes kept after each call. */
  bufferMinutes: number;
  /** A call can be booked at the earliest this many hours ahead. */
  minNoticeHours: number;
  /** Calls can be booked up to this many days ahead. */
  bookingWindowDays: number;
  /** https meeting link sent to the buyer (Zoom, Meet...); null means the coach sends it later. Never in public reads. */
  meetingUrl: string | null;
};

export type ProductDoc = {
  _id: string;
  storeId: string;
  /**
   * "digital" (Phase 1), "course" (course flow, D-054), "coaching" (D-081) or "lead_magnet" (D-094):
   * a free digital product that grows the creator's email list. A lead magnet is always free.
   */
  type: "digital" | "course" | "coaching" | "lead_magnet";
  /** Course settings, only when type is "course". */
  course?: CourseSettingsDoc;
  /** Coaching settings, only when type is "coaching". */
  coaching?: CoachingSettingsDoc;
  /**
   * Order bump (D-089): one other product of the store offered at checkout with a tick, at its own
   * price. Only digital products and courses can be the bump. Missing or null: no bump.
   */
  bump?: { productId: string; priceCents: number; headline: string | null } | null;
  /**
   * Upsell (D-099): one other product offered on the thank-you page after a paid order, at this
   * price, bought with a fresh checkout. Only digital products and courses. Missing or null: none.
   */
  upsell?: { productId: string; priceCents: number; headline: string | null } | null;
  /**
   * Downsell (D-115): offered on the thank-you page instead when the buyer says "No thanks" to the
   * upsell. Same rules and shape as the upsell. Missing or null: none.
   */
  downsell?: { productId: string; priceCents: number; headline: string | null } | null;
  /** License keys (D-114): each paid order of this digital product gets a unique key. Missing: off. */
  license?: { enabled: boolean } | null;
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
  /**
   * Set when the creator deletes a product that has orders (D-059): it leaves the store and the
   * dashboard, but its buyers keep access in their library. Missing or null on every other product.
   */
  deletedAt?: Date | null;
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
  /**
   * The buyer agreed to emails from the store (D-094): the "Email me updates" tick, or signing up
   * for a lead magnet. Saved with the exact words shown. Missing or null: no consent.
   */
  marketingConsent?: { at: Date; text: string } | null;
  /** When the abandoned cart reminder for this unfinished checkout went out (D-096); set once. */
  reminderSentAt?: Date | null;
  /** When the "please review" email for this paid order went out (D-117); set once. */
  reviewRequestSentAt?: Date | null;
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
  /** A coaching call's booked time (D-083), frozen at checkout; the live state is in `bookings`. */
  booking?: { start: Date; end: Date; buyerTimeZone: string | null } | null;
  /** The coupon used (D-088), frozen at checkout. Its discount is part of `discountCents`. */
  coupon?: { couponId: string; code: string; discountCents: number } | null;
  /** The order bump the buyer added (D-089), frozen at checkout; its price is part of `subtotalCents` and `totalCents`. */
  bump?: { productId: string; title: string; priceCents: number } | null;
  /**
   * Set on the $0 order made for a bump product when its parent order is paid (D-089), so the bump
   * reaches the buyer's library like any purchase. Creator lists and income leave these out.
   */
  bumpOf?: string | null;
  /** Set on an order bought from the upsell offer of the paid order with this id (D-099). */
  upsellOf?: string | null;
  /** Which after-purchase offer it was bought from (D-115). Missing on an `upsellOf` order: the upsell. */
  offer?: "upsell" | "downsell" | null;
  /**
   * Where the buyer came from (D-112): UTM tags of the link and the referring site's host, cleaned.
   * An upsell order copies its parent's. Missing or null: a direct visit (or an order from before).
   */
  attribution?: { source: string; medium: string | null; campaign: string | null; referrer: string | null } | null;
  /**
   * The affiliate whose link the buyer used (D-113), with the commission rate frozen at checkout.
   * An upsell order copies its parent's. Missing or null: no affiliate.
   */
  affiliate?: { affiliateId: string; code: string; commissionPercent: number } | null;
  createdAt: Date;
  paidAt: Date | null;
};

/**
 * A creator's coupon code (D-088). The code is unique per store, ignoring case (`codeKey`). Money
 * amounts are in the store's currency units. `redemptionCount` counts held and paid uses, so
 * `maxRedemptions` is never exceeded, even when buyers check out at the same moment.
 */
export type CouponDoc = {
  _id: string;
  storeId: string;
  /** As shown to buyers, upper case, for example "DIWALI20". */
  code: string;
  /** `code` upper-cased: unique per store (index `coupons_store_code_unique`). */
  codeKey: string;
  kind: "percent" | "amount";
  /** 1 to 100 when kind is "percent", else null. */
  percentOff: number | null;
  /** In store currency units when kind is "amount", else null. */
  amountOffCents: number | null;
  /** Only these products, or null for every product of the store. */
  productIds: string[] | null;
  /** How many orders may use it in total, or null for no limit. */
  maxRedemptions: number | null;
  redemptionCount: number;
  /** One use per buyer email. */
  oncePerEmail: boolean;
  /** Last moment it can be used, or null for no end. */
  expiresAt: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** One order's use of a coupon (D-088): "held" at checkout, "redeemed" once paid, "released" when the payment failed. */
export type CouponRedemptionDoc = {
  _id: string;
  storeId: string;
  couponId: string;
  orderId: string;
  status: "held" | "redeemed" | "released";
  /** `<couponId>|<email>` while held or redeemed for a once-per-email coupon, else null (unique index). */
  activeEmailKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * A coaching call's time slot (D-083), one per coaching order. "held" while the buyer pays (until
 * `holdExpiresAt`), "confirmed" once the order is paid (only through the verified payment path),
 * "released" when the payment failed or expired, "conflict" when a late payment found its time
 * taken, and "cancelled" when the creator cancelled the call or the order was fully refunded (D-086).
 */
export type BookingDoc = {
  _id: string;
  storeId: string;
  productId: string;
  orderId: string;
  start: Date;
  end: Date;
  status: "held" | "confirmed" | "released" | "conflict" | "cancelled";
  /** When the call was cancelled (D-086). */
  cancelledAt?: Date | null;
  /**
   * `<storeId>|<start ISO>` while the booking takes its time (held or confirmed), else null. A
   * unique index on it means one store can never have two calls starting at the same moment.
   */
  activeSlot: string | null;
  /** When a hold stops counting; null once confirmed or released. */
  holdExpiresAt: Date | null;
  /** When the order was paid and the time confirmed; with overlapping calls, the first confirmed keeps its time. */
  confirmedAt?: Date | null;
  /** The buyer's IANA time zone from the booking page, for emails (K4); null when not sent. */
  buyerTimeZone: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  /** The order email (D-037), or a coaching call reminder (D-085). */
  kind: "order-confirmation" | "call-reminder-24h" | "call-reminder-1h" | "call-cancelled";
  status: "sending" | "sent" | "failed";
  attempts: number;
  createdAt: Date;
  sentAt: Date | null;
};

/** An uploaded image (D-032). The file itself is in file storage under `key`; images are public. */
/** The bytes of one uploaded image (D-077), keyed by the upload's storage key. Kept in MongoDB so
 * images work on serverless hosting without a paid file store; at most MEDIA_MAX_BYTES each. */
export type MediaBlobDoc = { _id: string; storeId: string; bytes: Binary; size: number; createdAt: Date };

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
  /**
   * Where the bytes live (D-093). Missing on files saved before R2: they are on the disk.
   */
  storage?: "r2" | "disk";
  /**
   * "pending" from the signed upload link until the server has checked the uploaded bytes; such a
   * file is never shown or delivered, and is cleaned up after a day. Missing means ready.
   */
  status?: "pending" | "ready";
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
  // durationSeconds: Bunny's `length` once the video is ready (D-098), for the plan's video hours.
  | { kind: "bunny"; videoId: string; status: "uploading" | "processing" | "ready" | "failed"; durationSeconds?: number }
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
  /** An optional single-choice quiz (D-110). Missing on lessons made before quizzes existed. */
  quiz?: LessonQuizDoc | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * A license key (D-114), issued once per paid order of a product with license keys on, only from the
 * payment path. A key counts as valid while the order is paid and the creator has not revoked it.
 */
export type LicenseKeyDoc = {
  _id: string;
  storeId: string;
  productId: string;
  orderId: string;
  key: string;
  revokedAt: Date | null;
  createdAt: Date;
};

/**
 * A store's affiliate (D-113): someone who shares the store with their own `?ref=` code and earns a
 * commission the creator pays them outside the platform. `codeKey` is unique per store.
 */
export type AffiliateDoc = {
  _id: string;
  storeId: string;
  name: string;
  /** For the creator's own records; never shown to buyers. */
  email: string | null;
  code: string;
  codeKey: string;
  commissionPercent: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** A payment the creator says they made to an affiliate outside the platform (D-113). No money moves here. */
export type AffiliatePayoutDoc = {
  _id: string;
  storeId: string;
  affiliateId: string;
  amountCents: number;
  currency: string;
  note: string | null;
  createdAt: Date;
};

/**
 * A course certificate (D-111): one per order, issued when the student has finished every lesson.
 * The name, course title and store name are copied in when it is issued, so later edits do not
 * change a certificate. A refund of the order shows it as revoked.
 */
export type CertificateDoc = {
  _id: string;
  orderId: string;
  storeId: string;
  productId: string;
  studentName: string;
  courseTitle: string;
  storeName: string;
  issuedAt: Date;
};

/** A lesson quiz (D-110): cleaned text, one right option per question (creator-only data). */
export type LessonQuizDoc = { passPercent: number; questions: { prompt: string; options: string[]; correct: number }[] };

/**
 * A student's quiz results for one lesson (D-110). `_id` is "orderId:lessonId", so it is one
 * document however many times they try. Only scores are kept, never the answers.
 */
export type QuizAttemptDoc = {
  _id: string;
  orderId: string;
  storeId: string;
  productId: string;
  lessonId: string;
  attempts: number;
  lastPercent: number;
  bestPercent: number;
  /** When they first passed; null until then. */
  passedAt: Date | null;
  updatedAt: Date;
};

/**
 * A lesson a student marked complete (D-057). `_id` is "orderId:lessonId", so marking twice is one
 * document. Progress belongs to the order, which belongs to the buyer's verified email.
 */
export type LessonProgressDoc = { _id: string; orderId: string; storeId: string; productId: string; lessonId: string; completedAt: Date };

/**
 * A dashboard notification for a store (D-061): a sale, a refund, a lesson video that finished or
 * failed. `dedupeKey` is unique (for example "sale:<orderId>"), so a replayed webhook never makes a
 * second one. Old ones are removed by a TTL index after 90 days.
 */
export type NotificationDoc = {
  _id: string;
  storeId: string;
  kind: "sale" | "refund" | "video_ready" | "video_failed";
  dedupeKey: string;
  title: string;
  body: string;
  /** A dashboard path, never a full URL. */
  href: string;
  amountCents: number | null;
  currency: string | null;
  /** A development test order (mock payment). */
  test: boolean;
  createdAt: Date;
  readAt: Date | null;
};

/** Fixed-window rate-limit counter. Removed by a TTL index after `expiresAt`. */
export type RateLimitDoc = { _id: string; count: number; expiresAt: Date };

/**
 * A deleted account (D-074): only a one-way SHA-256 hash of the canonical email, so a new store
 * with the same email does not get another free trial. No name, no readable email.
 */
export type DeletedAccountDoc = { _id: string; deletedAt: Date };

/** One audit record (D-075): ids and a hashed IP only. Removed by a TTL index after ~13 months. */
export type AuditLogDoc = {
  _id: string;
  actorId: string;
  storeId: string | null;
  action: import("@/lib/audit/log").AuditAction;
  meta: Record<string, string | number | boolean>;
  ipHash: string | null;
  at: Date;
};

/**
 * Someone on a creator's email list (D-094). Added when a buyer agrees to emails at checkout or
 * signs up for a lead magnet, always with the consent words they saw. Unique per store and email
 * (index `subscribers_store_email_unique`). Creators are the data controller for this data.
 */
export type SubscriberDoc = {
  _id: string;
  storeId: string;
  /** As entered (trimmed); `emailKey` is the lower-case form used for uniqueness. */
  email: string;
  emailKey: string;
  name: string | null;
  status: "subscribed" | "unsubscribed";
  /** Where they first joined: a product (lead magnet or purchase). */
  /** Where they first joined: a product (lead magnet or purchase), or a CSV import (D-100: productId "", productTitle the file name). */
  source: { kind: "lead_magnet" | "purchase" | "import"; productId: string; productTitle: string };
  /** The latest consent: when, and the exact words shown. */
  consent: { at: Date; text: string };
  unsubscribedAt: Date | null;
  /** Why they left the list (D-095). Missing on entries from before it. */
  unsubscribeReason?: "user" | "creator" | "bounced" | "complained" | null;
  /**
   * Random token in this person's unsubscribe links (D-095); unique (index
   * `subscribers_unsubscribe_token_unique`). Given when they are first emailed.
   */
  unsubscribeToken?: string;
  /** The welcome email (D-095) went out, so it is never sent twice. */
  welcomedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * An email a creator sends to their subscribed list (D-095). Sent in batches of 100 by an Inngest
 * job; `cursor` is the last subscriber id sent, so a retried job continues where it stopped.
 */
export type BroadcastDoc = {
  _id: string;
  storeId: string;
  subject: string;
  body: string;
  /** The creator's sign-in email when they sent it: replies go there. */
  replyTo: string | null;
  status: "draft" | "sending" | "sent" | "failed";
  /** Subscribed people when sending started. */
  recipientCount: number;
  sentCount: number;
  cursor: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

/**
 * A buyer's review of a product they paid for (D-106). One per buyer and product (index
 * `reviews_store_product_buyer_unique`). Shown at once; the creator can hide or delete it.
 * `buyerName` is only the short display name ("Asha P."); the email is never shown.
 */
export type ReviewDoc = {
  _id: string;
  storeId: string;
  productId: string;
  orderId: string;
  /** Lower-case buyer email, for the one-review-per-buyer rule. Never shown. */
  buyerKey: string;
  buyerName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string | null;
  status: "published" | "hidden";
  createdAt: Date;
  updatedAt: Date;
};

/**
 * A signed-in admin session (D-108, D-109). `_id` is the SHA-256 of the random token in the cookie,
 * so a database leak does not give working sessions. Removed by a TTL index after `expiresAt`.
 * `credentials` is a fingerprint of the env username and password it was made with: changing them
 * in the environment ends every session.
 */
export type AdminSessionDoc = {
  _id: string;
  adminId: string;
  credentials: string;
  ipHash: string | null;
  createdAt: Date;
  expiresAt: Date;
};

export async function collections(): Promise<{
  profiles: Collection<ProfileDoc>;
  stores: Collection<StoreDoc>;
  products: Collection<ProductDoc>;
  uploads: Collection<UploadDoc>;
  mediaBlobs: Collection<MediaBlobDoc>;
  files: Collection<FileDoc>;
  orders: Collection<OrderDoc>;
  accessTokens: Collection<AccessTokenDoc>;
  emailOutbox: Collection<EmailOutboxDoc>;
  webhookEvents: Collection<WebhookEventDoc>;
  signupIntents: Collection<SignupIntentDoc>;
  rateLimits: Collection<RateLimitDoc>;
  deletedAccounts: Collection<DeletedAccountDoc>;
  auditLogs: Collection<AuditLogDoc>;
  connectStates: Collection<ConnectStateDoc>;
  courseModules: Collection<CourseModuleDoc>;
  lessons: Collection<LessonDoc>;
  lessonProgress: Collection<LessonProgressDoc>;
  quizAttempts: Collection<QuizAttemptDoc>;
  certificates: Collection<CertificateDoc>;
  affiliates: Collection<AffiliateDoc>;
  affiliatePayouts: Collection<AffiliatePayoutDoc>;
  licenseKeys: Collection<LicenseKeyDoc>;
  planPayments: Collection<PlanPaymentDoc>;
  notifications: Collection<NotificationDoc>;
  bookings: Collection<BookingDoc>;
  coupons: Collection<CouponDoc>;
  couponRedemptions: Collection<CouponRedemptionDoc>;
  subscribers: Collection<SubscriberDoc>;
  broadcasts: Collection<BroadcastDoc>;
  reviews: Collection<ReviewDoc>;
  adminSessions: Collection<AdminSessionDoc>;
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
    deletedAccounts: db.collection<DeletedAccountDoc>("deletedAccounts"),
    mediaBlobs: db.collection<MediaBlobDoc>("mediaBlobs"),
    auditLogs: db.collection<AuditLogDoc>("auditLogs"),
    connectStates: db.collection<ConnectStateDoc>("connectStates"),
    courseModules: db.collection<CourseModuleDoc>("courseModules"),
    lessons: db.collection<LessonDoc>("lessons"),
    lessonProgress: db.collection<LessonProgressDoc>("lessonProgress"),
    quizAttempts: db.collection<QuizAttemptDoc>("quizAttempts"),
    certificates: db.collection<CertificateDoc>("certificates"),
    affiliates: db.collection<AffiliateDoc>("affiliates"),
    affiliatePayouts: db.collection<AffiliatePayoutDoc>("affiliatePayouts"),
    licenseKeys: db.collection<LicenseKeyDoc>("licenseKeys"),
    planPayments: db.collection<PlanPaymentDoc>("planPayments"),
    notifications: db.collection<NotificationDoc>("notifications"),
    bookings: db.collection<BookingDoc>("bookings"),
    coupons: db.collection<CouponDoc>("coupons"),
    subscribers: db.collection<SubscriberDoc>("subscribers"),
    broadcasts: db.collection<BroadcastDoc>("broadcasts"),
    reviews: db.collection<ReviewDoc>("reviews"),
    adminSessions: db.collection<AdminSessionDoc>("adminSessions"),
    couponRedemptions: db.collection<CouponRedemptionDoc>("couponRedemptions"),
  };
}
