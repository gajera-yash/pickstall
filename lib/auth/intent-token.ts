import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { SIGNUP_RATE_LIMITS } from "@/lib/config";

// Pure helpers for signup intents (docs/DECISIONS.md D-019). No database or request access here.

export const INTENT_COOKIE = "signup_intent";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes in base64url

/** A new random token for the browser cookie (never stored; only its hash is). */
export function newIntentToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** HMAC of the client IP with a server secret, so the raw IP is never stored. */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

/** Constant-time check that a cookie token belongs to a stored hash. */
export function tokenMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function encodeIntentCookie(id: string, token: string): string {
  return `${id}.${token}`;
}

/** The intent id and token from the cookie, or null if the value is missing or malformed. */
export function parseIntentCookie(value: string | undefined | null): { id: string; token: string } | null {
  if (!value) return null;
  const [id, token, extra] = value.split(".");
  if (extra !== undefined || !id || !token || !UUID.test(id) || !TOKEN.test(token)) return null;
  return { id, token };
}

/**
 * Per-email limit: at most `max` signup attempts inside the window. Returns whether this attempt
 * is allowed and the counter values to store with it.
 */
export function nextEmailAttempt(
  existing: { attempts: number; window_started_at: string } | null,
  now: Date,
): { allowed: boolean; attempts: number; windowStartedAt: Date } {
  const { max, windowMinutes } = SIGNUP_RATE_LIMITS.perEmail;
  const windowStart = existing ? new Date(existing.window_started_at) : null;
  const inWindow = windowStart !== null && now.getTime() - windowStart.getTime() < windowMinutes * 60_000;

  if (!existing || !inWindow || !windowStart) return { allowed: true, attempts: 1, windowStartedAt: now };
  if (existing.attempts >= max) return { allowed: false, attempts: existing.attempts, windowStartedAt: windowStart };
  return { allowed: true, attempts: existing.attempts + 1, windowStartedAt: windowStart };
}
