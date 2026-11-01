import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { ACCESS_LINK_DAYS, ACCESS_RECORD_DAYS } from "@/lib/config";
import { collections, type AccessTokenDoc } from "@/lib/db/collections";

// The unique link in an order email (D-037). The token is 32 random bytes; the database keeps only
// its hash, so a leaked database cannot be used to build working links.

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isTokenShape(value: string): boolean {
  return typeof value === "string" && TOKEN.test(value);
}

/** Creates a link token for this order and email. Returns the plain token, which only goes into the email. */
export async function createAccessToken(input: { orderId: string; email: string; name: string }, now = new Date()): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const { accessTokens } = await collections();
  await accessTokens.insertOne({
    _id: hashToken(token),
    orderId: input.orderId,
    email: input.email.trim().toLowerCase(),
    name: input.name,
    createdAt: now,
    expiresAt: new Date(now.getTime() + ACCESS_LINK_DAYS * 86_400_000),
    usedAt: null,
    deleteAt: new Date(now.getTime() + ACCESS_RECORD_DAYS * 86_400_000),
  });
  return token;
}

export type TokenState = { status: "valid"; token: AccessTokenDoc } | { status: "used" | "expired" | "invalid" };

/** Looks a token up without using it. A badly shaped token never reaches the database. */
export async function lookupAccessToken(token: string, now = new Date()): Promise<TokenState> {
  if (!isTokenShape(token)) return { status: "invalid" };
  const { accessTokens } = await collections();
  const doc = await accessTokens.findOne({ _id: hashToken(token) });
  if (!doc) return { status: "invalid" };
  if (doc.usedAt) return { status: "used" };
  if (doc.expiresAt.getTime() <= now.getTime()) return { status: "expired" };
  return { status: "valid", token: doc };
}

/** Marks the token used. Only one caller can win: the update matches while `usedAt` is still null. */
export async function consumeAccessToken(token: string, now = new Date()): Promise<boolean> {
  const { accessTokens } = await collections();
  const result = await accessTokens.updateOne({ _id: hashToken(token), usedAt: null, expiresAt: { $gt: now } }, { $set: { usedAt: now } });
  return result.matchedCount === 1;
}

/** Gives a token back (sets it unused again) when saving the password failed, so the buyer can retry. */
export async function releaseAccessToken(token: string): Promise<void> {
  const { accessTokens } = await collections();
  await accessTokens.updateOne({ _id: hashToken(token) }, { $set: { usedAt: null } });
}
