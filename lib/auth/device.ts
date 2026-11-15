import "server-only";

import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

// A random id for this browser (D-071), used only to limit how many stores one browser opens
// (STORE_CREATION_LIMITS). It is not a fingerprint: it identifies nothing about the person or the
// device, and clearing cookies resets it, which is why the limit is soft. Only its hash is stored.

export const DEVICE_COOKIE = "ps_device";
const VALUE = /^[A-Za-z0-9_-]{43}$/;
/** Browsers cap cookie lifetime at 400 days. */
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/**
 * This browser's id, created when missing. Creating it sets a cookie, so call this from a server
 * action or a route handler, not while rendering a page.
 */
export async function deviceId(): Promise<string> {
  const store = await cookies();
  const current = store.get(DEVICE_COOKIE)?.value;
  if (current && VALUE.test(current)) return current;
  const value = randomBytes(32).toString("base64url");
  store.set(DEVICE_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return value;
}
