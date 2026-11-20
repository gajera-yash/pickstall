import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Platform admin sign-in helpers (D-107, D-108). Admin accounts and sessions live in MongoDB
// (lib/admin/accounts.ts).
// - Passwords are stored only as scrypt hashes: scrypt$<N>$<r>$<p>$<salt b64url>$<hash b64url>
//   (the same format scripts/admin-create.mjs writes).
// - A session is a random token in an httpOnly cookie; the database keeps only its SHA-256.

export const ADMIN_COOKIE = "ps_admin";
export const ADMIN_SESSION_HOURS = 8;

const KEY_LENGTH = 64;

/** A new scrypt hash in the stored format (used by tests; the script has the same code). */
export function hashPassword(password: string, salt: Buffer = randomBytes(16), cost = { N: 16384, r: 8, p: 1 }): string {
  const hash = scryptSync(password.normalize("NFKC"), salt, KEY_LENGTH, { ...cost, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", cost.N, cost.r, cost.p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

/** True when the password matches the stored hash. Constant time; any malformed hash is false. */
export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (!N || !r || !p || N > 2 ** 20 || r > 32 || p > 16) return false;
  const salt = Buffer.from(parts[4] ?? "", "base64url");
  const expected = Buffer.from(parts[5] ?? "", "base64url");
  if (salt.length < 8 || expected.length !== KEY_LENGTH) return false;
  try {
    const actual = scryptSync(password.normalize("NFKC"), salt, KEY_LENGTH, { N, r, p, maxmem: 64 * 1024 * 1024 });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

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
