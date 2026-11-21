import "server-only";

import { collections, type StorePayPal } from "@/lib/db/collections";
import type { PayPalCredentials } from "@/lib/payments/paypal-api";
import { credentialsKey, paypalMode } from "@/lib/payments/paypal-config";
import { openSecret, sealSecret } from "@/lib/security/secret-box";

// A store's own PayPal REST app (D-118). Writes are scoped by the owner id from the verified
// session; the decrypted secret is only ever returned to lib/payments for API calls, never to the
// browser. The store id is the encryption AAD, so a sealed secret cannot be copied to another store.

export type StorePayPalCredentials = { storeId: string; credentials: PayPalCredentials; webhookId: string | null };

function unseal(storeId: string, paypal: StorePayPal): StorePayPalCredentials {
  return {
    storeId,
    credentials: { mode: paypal.mode, clientId: paypal.clientId, secret: openSecret(paypal.secretSealed, credentialsKey(), storeId) },
    webhookId: paypal.webhookId,
  };
}

/** The owner's store id, or null. */
export async function storeIdOfOwner(ownerId: string): Promise<string | null> {
  const { stores } = await collections();
  const doc = await stores.findOne({ ownerId }, { projection: { _id: 1 } });
  return doc?._id ?? null;
}

/** Saves (or replaces) the owner's PayPal app. The secret is encrypted before it is stored. */
export async function savePayPalConnection(ownerId: string, storeId: string, input: { credentials: PayPalCredentials; webhookId: string | null }): Promise<boolean> {
  const { stores } = await collections();
  const paypal: StorePayPal = {
    mode: input.credentials.mode,
    clientId: input.credentials.clientId,
    secretSealed: sealSecret(input.credentials.secret, credentialsKey(), storeId),
    webhookId: input.webhookId,
    connectedAt: new Date(),
  };
  const result = await stores.updateOne({ _id: storeId, ownerId }, { $set: { paypal, updatedAt: new Date() } });
  return result.matchedCount === 1;
}

/** Removes the owner's PayPal app and returns what was saved (to delete our webhook on it), or null. */
export async function removePayPalConnection(ownerId: string): Promise<StorePayPalCredentials | null> {
  const { stores } = await collections();
  const before = await stores.findOneAndUpdate({ ownerId, paypal: { $exists: true } }, { $unset: { paypal: "" }, $set: { updatedAt: new Date() } }, { projection: { _id: 1, paypal: 1 } });
  if (!before?.paypal) return null;
  try {
    return unseal(before._id, before.paypal);
  } catch {
    return null; // a secret that no longer opens (key changed): nothing to clean up with it
  }
}

/** The owner's saved app (decrypted), or null. For replacing a connection. */
export async function paypalConnectionOfOwner(ownerId: string): Promise<StorePayPalCredentials | null> {
  const { stores } = await collections();
  const doc = await stores.findOne({ ownerId, paypal: { $exists: true } }, { projection: { _id: 1, paypal: 1 } });
  if (!doc?.paypal) return null;
  try {
    return unseal(doc._id, doc.paypal);
  } catch {
    return null;
  }
}

/**
 * The store's PayPal app for a checkout, refund or webhook, or null when the store has none, it is in
 * the other mode (a sandbox app on a live server or the reverse), or its secret cannot be opened.
 */
export async function paypalCredentialsOfStore(storeId: string): Promise<StorePayPalCredentials | null> {
  const { stores } = await collections();
  const doc = await stores.findOne({ _id: storeId, paypal: { $exists: true } }, { projection: { _id: 1, paypal: 1 } });
  if (!doc?.paypal || doc.paypal.mode !== paypalMode()) return null;
  try {
    return unseal(doc._id, doc.paypal);
  } catch {
    return null;
  }
}
