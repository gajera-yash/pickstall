import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encrypts small secrets at rest (D-118: creators' PayPal app secrets) with AES-256-GCM. The stored
// form is "v1.<iv>.<tag>.<ciphertext>" in base64url; the key never leaves the server. Pure (the key
// is passed in), so it is unit-tested; lib/payments reads the key from PAYMENT_CREDENTIALS_KEY.

const VERSION = "v1";

function keyBytes(key: string): Buffer {
  const bytes = Buffer.from(key, "base64");
  if (bytes.length !== 32) throw new Error("The encryption key must be 32 bytes.");
  return bytes;
}

/** Encrypts `plain` with a fresh random IV. `aad` binds the result to its owner (a store id), so it cannot be moved. */
export function sealSecret(plain: string, key: string, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

/** Decrypts a value made by sealSecret with the same key and `aad`. Throws when it was changed or belongs to someone else. */
export function openSecret(sealed: string, key: string, aad: string): string {
  const [version, iv, tag, ciphertext] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error("Unknown secret format.");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(key), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
