import "server-only";

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
    db.collection("products").createIndex({ storeId: 1, slug: 1 }, { unique: true, name: "products_store_slug_unique" }),
    db.collection("products").createIndex({ storeId: 1, status: 1, sortOrder: 1 }, { name: "products_store_status" }),
    db.collection("orders").createIndex({ providerSessionId: 1 }, { unique: true, partialFilterExpression: { providerSessionId: { $type: "string" } }, name: "orders_provider_session_unique" }),
    db.collection("orders").createIndex({ providerPaymentId: 1 }, { unique: true, partialFilterExpression: { providerPaymentId: { $type: "string" } }, name: "orders_provider_payment_unique" }),
    db.collection("orders").createIndex({ buyerEmail: 1, status: 1, paidAt: -1 }, { name: "orders_buyer_email" }),
    db.collection("orders").createIndex({ storeId: 1, createdAt: -1 }, { name: "orders_store_created" }),
    db.collection("accessTokens").createIndex({ deleteAt: 1 }, { expireAfterSeconds: 0, name: "access_tokens_ttl" }),
    db.collection("accessTokens").createIndex({ orderId: 1 }, { name: "access_tokens_order" }),
    db.collection("uploads").createIndex({ storeId: 1, createdAt: -1 }, { name: "uploads_store" }),
    db.collection("signupIntents").createIndex({ email: 1 }, { unique: true, name: "signup_intents_email_unique" }),
    db.collection("signupIntents").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "signup_intents_ttl" }),
    db.collection("signupIntents").createIndex({ ipHash: 1, createdAt: 1 }, { name: "signup_intents_ip" }),
    db.collection("rateLimits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "rate_limits_ttl" }),
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

/** The app database with its indexes in place. Use this from data-access code. */
export async function getDb(): Promise<Db> {
  await ensureConnected();
  globalForMongo.pickstallIndexes ??= ensureIndexes(mongoDb).catch((error: unknown) => {
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
