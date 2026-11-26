import "server-only";

import { createHash } from "node:crypto";

import { MongoClient, MongoServerError, type Db } from "mongodb";

import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";

// The one MongoDB client for the app (D-024). Only server code imports this file.
// In development the client is kept on globalThis so hot reloads do not open new connections.

const globalForMongo = globalThis as unknown as { pickstallMongo?: MongoClient; pickstallIndexes?: Promise<void> };

// 10 s instead of the driver's 30 s, so a database that cannot be reached shows up quickly.
export const mongoClient: MongoClient = globalForMongo.pickstallMongo ?? new MongoClient(serverEnv.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
if (process.env.NODE_ENV !== "production") globalForMongo.pickstallMongo = mongoClient;

/** The app database. The driver connects lazily on the first operation. */
export const mongoDb: Db = mongoClient.db(serverEnv.MONGODB_DB);

/**
 * Indexes are the database's guarantees (unique usernames, one store per owner, expiring rows),
 * so the app relies on them instead of check-then-insert. Created once per process; idempotent.
 */
async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("stores").createIndex({ slug: 1 }, { unique: true, name: "stores_slug_unique" }),
    db.collection("stores").createIndex({ ownerId: 1 }, { unique: true, name: "stores_owner_unique" }),
    // One store per inbox and one store per real Stripe account (D-071). Partial: older stores
    // without the field do not collide until the migration fills it in.
    db.collection("stores").createIndex({ ownerEmailKey: 1 }, { unique: true, partialFilterExpression: { ownerEmailKey: { $type: "string" } }, name: "stores_owner_email_unique" }),
    db.collection("stores").createIndex({ "billing.customerId": 1 }, { unique: true, partialFilterExpression: { "billing.customerId": { $type: "string" } }, name: "stores_billing_customer_unique" }),
    db.collection("stores").createIndex({ "billing.subscriptionId": 1 }, { partialFilterExpression: { "billing.subscriptionId": { $type: "string" } }, name: "stores_billing_subscription" }),
    db.collection("stores").createIndex({ stripeClaimKey: 1 }, { unique: true, partialFilterExpression: { stripeClaimKey: { $type: "string" } }, name: "stores_stripe_claim_unique" }),
    db.collection("products").createIndex({ storeId: 1, slug: 1 }, { unique: true, name: "products_store_slug_unique" }),
    db.collection("products").createIndex({ storeId: 1, status: 1, sortOrder: 1 }, { name: "products_store_status" }),
    // Product import: one product per store per source item (Gumroad id or CSV title key). Partial: only imported products.
    db.collection("products").createIndex(
      { storeId: 1, "importedFrom.source": 1, "importedFrom.externalId": 1 },
      { unique: true, partialFilterExpression: { "importedFrom.externalId": { $type: "string" } }, name: "products_store_import_unique" },
    ),
    db.collection("orders").createIndex({ providerSessionId: 1 }, { unique: true, partialFilterExpression: { providerSessionId: { $type: "string" } }, name: "orders_provider_session_unique" }),
    db.collection("orders").createIndex({ providerPaymentId: 1 }, { unique: true, partialFilterExpression: { providerPaymentId: { $type: "string" } }, name: "orders_provider_payment_unique" }),
    db.collection("orders").createIndex({ buyerEmail: 1, status: 1, paidAt: -1 }, { name: "orders_buyer_email" }),
    db.collection("orders").createIndex({ storeId: 1, createdAt: -1 }, { name: "orders_store_created" }),
    db.collection("accessTokens").createIndex({ deleteAt: 1 }, { expireAfterSeconds: 0, name: "access_tokens_ttl" }),
    db.collection("accessTokens").createIndex({ orderId: 1 }, { name: "access_tokens_order" }),
    db.collection("uploads").createIndex({ storeId: 1, createdAt: -1 }, { name: "uploads_store" }),
    // Image bytes (D-077): looked up by key (_id); by store for clean-up.
    db.collection("mediaBlobs").createIndex({ storeId: 1 }, { name: "media_blobs_store" }),
    db.collection("files").createIndex({ storeId: 1, productId: 1 }, { name: "files_store_product" }),
    db.collection("signupIntents").createIndex({ email: 1 }, { unique: true, name: "signup_intents_email_unique" }),
    db.collection("signupIntents").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "signup_intents_ttl" }),
    db.collection("signupIntents").createIndex({ ipHash: 1, createdAt: 1 }, { name: "signup_intents_ip" }),
    db.collection("connectStates").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "connect_states_ttl" }),
    // Connect webhooks find the store(s) of a Stripe account (account.updated, deauthorization).
    db.collection("stores").createIndex({ stripeAccountId: 1 }, { partialFilterExpression: { stripeAccountId: { $type: "string" } }, name: "stores_stripe_account" }),
    db.collection("rateLimits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "rate_limits_ttl" }),
    // Audit log (D-075): a person's own activity, newest first; records expire after 400 days.
    db.collection("auditLogs").createIndex({ actorId: 1, at: -1 }, { name: "audit_actor_at" }),
    db.collection("auditLogs").createIndex({ at: 1 }, { expireAfterSeconds: 400 * 24 * 60 * 60, name: "audit_ttl" }),
    // The admin's audit log (D-116): by action, or by store, newest first.
    db.collection("auditLogs").createIndex({ action: 1, at: -1 }, { name: "audit_action_at" }),
    db.collection("auditLogs").createIndex({ storeId: 1, at: -1 }, { name: "audit_store_at" }),
    // Course curriculum (D-055): every read filters by store and course, in order.
    db.collection("courseModules").createIndex({ storeId: 1, productId: 1, sortOrder: 1 }, { name: "course_modules_store_course" }),
    db.collection("lessons").createIndex({ storeId: 1, productId: 1, moduleId: 1, sortOrder: 1 }, { name: "lessons_store_course_module" }),
    // The Bunny webhook finds a lesson by its video id.
    db.collection("lessons").createIndex({ "video.videoId": 1 }, { partialFilterExpression: { "video.kind": "bunny" }, name: "lessons_bunny_video" }),
    db.collection("files").createIndex({ storeId: 1, lessonId: 1 }, { partialFilterExpression: { lessonId: { $type: "string" } }, name: "files_store_lesson" }),
    // Pending uploads (D-093), for the daily clean-up of uploads that never finished.
    db.collection("files").createIndex({ createdAt: 1 }, { partialFilterExpression: { status: "pending" }, name: "files_pending_created" }),
    // A student's progress is read per order (D-057).
    db.collection("lessonProgress").createIndex({ orderId: 1 }, { name: "lesson_progress_order" }),
    // Quiz results are read per order too (D-110).
    db.collection("quizAttempts").createIndex({ orderId: 1 }, { name: "quiz_attempts_order" }),
    // One certificate per order (D-111).
    db.collection("certificates").createIndex({ orderId: 1 }, { unique: true, name: "certificates_order_unique" }),
    // Plan payments (D-116): by date for revenue, by store for its history.
    db.collection("planPayments").createIndex({ paidAt: -1 }, { name: "plan_payments_paid" }),
    db.collection("planPayments").createIndex({ storeId: 1, paidAt: -1 }, { name: "plan_payments_store_paid" }),
    // License keys (D-114): one per order, and a key is unique within its store.
    db.collection("licenseKeys").createIndex({ orderId: 1 }, { unique: true, name: "license_keys_order_unique" }),
    db.collection("licenseKeys").createIndex({ storeId: 1, key: 1 }, { unique: true, name: "license_keys_store_key_unique" }),
    // Affiliates (D-113): one code per store; their orders and payouts are read per store and affiliate.
    db.collection("affiliates").createIndex({ storeId: 1, codeKey: 1 }, { unique: true, name: "affiliates_store_code_unique" }),
    db.collection("affiliatePayouts").createIndex({ storeId: 1, affiliateId: 1, createdAt: -1 }, { name: "affiliate_payouts_store_affiliate" }),
    db.collection("orders").createIndex(
      { storeId: 1, "affiliate.affiliateId": 1 },
      { partialFilterExpression: { "affiliate.affiliateId": { $type: "string" } }, name: "orders_store_affiliate" },
    ),
    // Dashboard notifications (D-061): newest first per store, one per event, gone after 90 days.
    db.collection("notifications").createIndex({ storeId: 1, createdAt: -1 }, { name: "notifications_store_created" }),
    db.collection("notifications").createIndex({ dedupeKey: 1 }, { unique: true, name: "notifications_dedupe_unique" }),
    db.collection("notifications").createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60, name: "notifications_ttl" }),
    // Coaching bookings (D-083): one active booking per store and start time, one booking per order.
    db.collection("bookings").createIndex({ activeSlot: 1 }, { unique: true, partialFilterExpression: { activeSlot: { $type: "string" } }, name: "bookings_active_slot_unique" }),
    db.collection("bookings").createIndex({ orderId: 1 }, { unique: true, name: "bookings_order_unique" }),
    db.collection("bookings").createIndex({ storeId: 1, start: 1 }, { name: "bookings_store_start" }),
    // Coupons (D-088): one code per store ignoring case; one use per order; one active use per email when asked.
    db.collection("coupons").createIndex({ storeId: 1, codeKey: 1 }, { unique: true, name: "coupons_store_code_unique" }),
    // Email list (D-094): one entry per store and email; the dashboard lists the newest first.
    db.collection("subscribers").createIndex({ storeId: 1, emailKey: 1 }, { unique: true, name: "subscribers_store_email_unique" }),
    db.collection("subscribers").createIndex({ storeId: 1, createdAt: -1 }, { name: "subscribers_store_created" }),
    // Broadcasts and unsubscribe links (D-095).
    db.collection("subscribers").createIndex({ unsubscribeToken: 1 }, { unique: true, partialFilterExpression: { unsubscribeToken: { $type: "string" } }, name: "subscribers_unsubscribe_token_unique" }),
    db.collection("subscribers").createIndex({ storeId: 1, status: 1, _id: 1 }, { name: "subscribers_store_status_id" }),
    db.collection("broadcasts").createIndex({ storeId: 1, createdAt: -1 }, { name: "broadcasts_store_created" }),
    // Finding broadcasts stuck in "sending" (D-117).
    db.collection("broadcasts").createIndex({ status: 1, updatedAt: 1 }, { name: "broadcasts_status_updated" }),
    // Product reviews (D-106): one per buyer and product; public lists per product; the creator's list.
    db.collection("reviews").createIndex({ storeId: 1, productId: 1, buyerKey: 1 }, { unique: true, name: "reviews_store_product_buyer_unique" }),
    db.collection("reviews").createIndex({ storeId: 1, productId: 1, status: 1, createdAt: -1 }, { name: "reviews_store_product_status" }),
    db.collection("reviews").createIndex({ storeId: 1, createdAt: -1 }, { name: "reviews_store_created" }),
    // Platform admin sessions (D-108, D-109). They disappear after they expire.
    db.collection("adminSessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "admin_sessions_ttl" }),
    db.collection("adminSessions").createIndex({ adminId: 1 }, { name: "admin_sessions_admin" }),
    // Abandoned cart reminders (D-096): the 7-day check per buyer and product, and the stats.
    db.collection("orders").createIndex({ storeId: 1, reminderSentAt: -1 }, { partialFilterExpression: { reminderSentAt: { $type: "date" } }, name: "orders_store_reminded" }),
    db.collection("couponRedemptions").createIndex({ orderId: 1 }, { unique: true, name: "coupon_redemptions_order_unique" }),
    db.collection("couponRedemptions").createIndex({ activeEmailKey: 1 }, { unique: true, partialFilterExpression: { activeEmailKey: { $type: "string" } }, name: "coupon_redemptions_email_unique" }),
    // Order bumps (D-089): at most one bump order per parent order.
    db.collection("orders").createIndex({ bumpOf: 1 }, { unique: true, partialFilterExpression: { bumpOf: { $type: "string" } }, name: "orders_bump_of_unique" }),
    // Upsell orders of a paid order (D-099). Not unique: a buyer may retry after a failed checkout.
    db.collection("orders").createIndex({ upsellOf: 1 }, { partialFilterExpression: { upsellOf: { $type: "string" } }, name: "orders_upsell_of" }),
    // Outreach leads (D-120): one lead per platform and username, one lead per `?ref=` code, the
    // list sorted by followers (optionally per stage), and a lead's signup found by its code (D-119).
    db.collection("mktLeads").createIndex({ handleKey: 1 }, { unique: true, name: "mkt_leads_handle_unique" }),
    db.collection("mktLeads").createIndex({ refCode: 1 }, { unique: true, name: "mkt_leads_ref_unique" }),
    db.collection("mktLeads").createIndex({ followers: -1, _id: 1 }, { name: "mkt_leads_followers" }),
    db.collection("mktLeads").createIndex({ stage: 1, followers: -1 }, { name: "mkt_leads_stage_followers" }),
    db.collection("mktEvents").createIndex({ leadId: 1, at: -1 }, { name: "mkt_events_lead_at" }),
    db.collection("mktEvents").createIndex({ at: -1, type: 1 }, { name: "mkt_events_at_type" }),
    // DM drafts (D-121): a lead's newest draft, drafts written per day (the daily limit), and
    // contacted leads by when they were messaged (follow-ups due).
    db.collection("mktDrafts").createIndex({ leadId: 1, createdAt: -1 }, { name: "mkt_drafts_lead_created" }),
    db.collection("mktDrafts").createIndex({ createdAt: -1 }, { name: "mkt_drafts_created" }),
    db.collection("mktLeads").createIndex({ stage: 1, lastContactedAt: 1 }, { name: "mkt_leads_stage_contacted" }),
    db.collection("stores").createIndex({ "acquisition.ref": 1 }, { partialFilterExpression: { "acquisition.ref": { $type: "string" } }, name: "stores_acquisition_ref" }),
    // Browser push (D-132): a store's browsers, and a user's (removed with the account).
    db.collection("pushSubscriptions").createIndex({ storeId: 1 }, { name: "push_subscriptions_store" }),
    db.collection("pushSubscriptions").createIndex({ userId: 1 }, { name: "push_subscriptions_user" }),
    // Better Auth collections (it does not create indexes for MongoDB itself).
    db.collection("user").createIndex({ email: 1 }, { unique: true, name: "user_email_unique" }),
    db.collection("session").createIndex({ token: 1 }, { unique: true, name: "session_token_unique" }),
    db.collection("session").createIndex({ userId: 1 }, { name: "session_user" }),
    db.collection("account").createIndex({ userId: 1 }, { name: "account_user" }),
    db.collection("verification").createIndex({ identifier: 1 }, { name: "verification_identifier" }),
  ]);
}

/**
 * Connects explicitly (D-041). After a failed connection (Atlas not allowing this IP, network down)
 * the driver keeps a closed topology and its automatic connect never replaces it, so every later
 * operation fails with MongoTopologyClosedError until the server restarts. An explicit connect()
 * opens a new one. Costs nothing when already connected.
 */
export async function ensureConnected(): Promise<void> {
  await mongoClient.connect();
}

/**
 * The version of the index list: a hash of `ensureIndexes` itself, so adding or changing an index
 * gives a new version without anyone having to remember to bump a number.
 */
export const INDEX_VERSION = createHash("sha256").update(ensureIndexes.toString()).digest("hex").slice(0, 16);

type AppMetaDoc = { _id: string; version: string; at: Date };

/**
 * Builds the indexes only when this version has not built them yet (D-127). Before, every new
 * server instance sent all ~80 createIndex commands and its first request waited for them (7-10 s
 * cold starts). Now a cold start costs one read of `appMeta`; the full list runs once per new index
 * version (in practice once per deploy that changes indexes). createIndex stays idempotent, so two
 * instances building at once is harmless.
 */
export async function ensureIndexesOnce(db: Db, build: (db: Db) => Promise<void> = ensureIndexes): Promise<"built" | "current"> {
  const meta = db.collection<AppMetaDoc>("appMeta");
  const saved = await meta.findOne({ _id: "indexes" }, { projection: { version: 1 } });
  if (saved?.version === INDEX_VERSION) return "current";
  await build(db);
  await meta.updateOne({ _id: "indexes" }, { $set: { version: INDEX_VERSION, at: new Date() } }, { upsert: true });
  return "built";
}

/** The app database with its indexes in place. Use this from data-access code. */
export async function getDb(): Promise<Db> {
  await ensureConnected();
  globalForMongo.pickstallIndexes ??= ensureIndexesOnce(mongoDb).then(() => undefined).catch((error: unknown) => {
    globalForMongo.pickstallIndexes = undefined; // retry on the next call
    logger.error("db.ensure_indexes_failed", { code: error instanceof MongoServerError ? error.code : undefined });
    throw error;
  });
  await globalForMongo.pickstallIndexes;
  return mongoDb;
}

/** True for a unique-index violation, optionally only on the given field. */
export function isDuplicateKeyError(error: unknown, field?: string): boolean {
  if (!(error instanceof MongoServerError) || error.code !== 11000) return false;
  if (!field) return true;
  const pattern: unknown = error.keyPattern;
  return typeof pattern === "object" && pattern !== null && field in pattern;
}
