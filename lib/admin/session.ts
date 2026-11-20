import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Platform admin sign-in helpers (D-109). The credentials come from the environment and sessions
// live in MongoDB (lib/admin/accounts.ts). A session is a random token in an httpOnly cookie; the
// database keeps only its SHA-256.

export const ADMIN_COOKIE = "ps_admin";
export const ADMIN_SESSION_HOURS = 8;

/** Constant-time string comparison (different lengths are simply false). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** A new random session token for the cookie (never stored as is). */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What the database keeps for a session token: its SHA-256. */
export function sessionTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A session token looks like one we made (43 URL-safe characters); anything else is ignored. */
export function isSessionToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
