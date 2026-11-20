import { z } from "zod";

// License keys (D-114). Client-safe. A key is 20 random characters from Crockford's base32 (no I, L,
// O or U, so it is easy to read and type), in four groups: "ABCDE-FGHJK-MNPQR-STVWX" (100 bits).

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const LICENSE_KEY = /^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}$/;

/** A new key from 20 random bytes (only the low 5 bits of each are used, so every character is equally likely). */
export function formatLicenseKey(bytes: Uint8Array): string {
  if (bytes.length < 20) throw new Error("need 20 random bytes");
  const chars = Array.from(bytes.slice(0, 20), (byte) => ALPHABET[byte & 31]);
  return [0, 5, 10, 15].map((start) => chars.slice(start, start + 5).join("")).join("-");
}

/**
 * A key as typed by a person or sent by software, in the stored form, or null. Lower case, spaces
 * and missing dashes are fine, and the look-alikes I/L (1) and O (0) are read the Crockford way.
 */
export function normalizeLicenseKey(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 60) return null;
  const compact = raw.toUpperCase().replace(/[\s-]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0");
  if (compact.length !== 20) return null;
  const key = [0, 5, 10, 15].map((start) => compact.slice(start, start + 5)).join("-");
  return LICENSE_KEY.test(key) ? key : null;
}

/** The verify API's request body. */
export const verifyLicenseInput = z.object({
  store: z.string().trim().toLowerCase().min(1).max(40),
  key: z.string().max(60),
});

export type LicenseStatus = "active" | "revoked" | "refunded";
