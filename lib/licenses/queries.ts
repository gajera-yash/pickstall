import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { collections, type LicenseKeyDoc } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { formatLicenseKey, normalizeLicenseKey, type LicenseStatus } from "@/lib/licenses/rules";

// License keys (D-114). Keys are issued only from the payment path (`onOrderPaid`), once per order:
// the unique index on `orderId` makes a replayed webhook harmless. Creator reads and writes filter by
// the session's store id; the public verify answer says only whether a key is valid.

export type OrderLicense = { key: string; status: LicenseStatus };

function statusOf(license: Pick<LicenseKeyDoc, "revokedAt">, orderStatus: string | undefined): LicenseStatus {
  if (orderStatus !== "paid") return "refunded";
  return license.revokedAt ? "revoked" : "active";
}

/**
 * Issues the key of a paid order when its product has license keys on. Safe to call again: the
 * order's existing key is kept. Returns the key, or null when the order gets none.
 */
export async function issueLicenseForOrder(orderId: string, now: Date = new Date()): Promise<string | null> {
  const { orders, products, licenseKeys } = await collections();
  const order = await orders.findOne({ _id: orderId, status: "paid" }, { projection: { storeId: 1, productId: 1 } });
  if (!order) return null;
  const product = await products.findOne({ _id: order.productId, storeId: order.storeId, type: "digital", "license.enabled": true }, { projection: { _id: 1 } });
  if (!product) return null;

  // Two tries: a clash of 100 random bits is practically impossible, but the index would catch it.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const doc: LicenseKeyDoc = { _id: randomUUID(), storeId: order.storeId, productId: order.productId, orderId, key: formatLicenseKey(randomBytes(20)), revokedAt: null, createdAt: now };
    try {
      await licenseKeys.insertOne(doc);
      return doc.key;
    } catch (error) {
      if (isDuplicateKeyError(error, "orderId")) return (await licenseKeys.findOne({ orderId }, { projection: { key: 1 } }))?.key ?? null;
      if (!isDuplicateKeyError(error)) throw error;
    }
  }
  return null;
}

/** An order's key and its status, for the buyer's own library and the confirmation email (callers check the order is theirs). */
export async function licenseOfOrder(orderId: string): Promise<OrderLicense | null> {
  const { licenseKeys, orders } = await collections();
  const license = await licenseKeys.findOne({ orderId }, { projection: { key: 1, revokedAt: 1, storeId: 1 } });
  if (!license) return null;
  const order = await orders.findOne({ _id: orderId, storeId: license.storeId }, { projection: { status: 1 } });
  return { key: license.key, status: statusOf(license, order?.status) };
}

/** The key of this store's order, for the creator's order details. */
export async function licenseForStoreOrder(storeId: string, orderId: string): Promise<OrderLicense | null> {
  const { licenseKeys, orders } = await collections();
  const license = await licenseKeys.findOne({ orderId, storeId }, { projection: { key: 1, revokedAt: 1 } });
  if (!license) return null;
  const order = await orders.findOne({ _id: orderId, storeId }, { projection: { status: 1 } });
  return { key: license.key, status: statusOf(license, order?.status) };
}

/** Revokes or restores the key of this store's order. False when there is none. */
export async function setLicenseRevoked(storeId: string, orderId: string, revoked: boolean, now: Date = new Date()): Promise<boolean> {
  const { licenseKeys } = await collections();
  const result = await licenseKeys.updateOne({ orderId, storeId }, { $set: { revokedAt: revoked ? now : null } });
  return result.matchedCount === 1;
}

/** Turns license keys on or off for one of this store's digital products. Keys already issued stay. */
export async function setProductLicense(storeId: string, productId: string, enabled: boolean): Promise<boolean> {
  const { products } = await collections();
  const result = await products.updateOne({ _id: productId, storeId, type: "digital", deletedAt: null }, { $set: { license: { enabled }, updatedAt: new Date() } });
  return result.matchedCount === 1;
}

export type VerifyAnswer = { valid: true; product: string } | { valid: false; reason: "not_found" | "revoked" | "refunded" };

/**
 * The public check for a key of one store (by its username). It answers valid with the product's
 * title, or why not. Nothing about the buyer is returned.
 */
export async function verifyLicense(storeSlug: string, rawKey: unknown): Promise<VerifyAnswer> {
  const key = normalizeLicenseKey(rawKey);
  if (!key) return { valid: false, reason: "not_found" };
  const { stores, licenseKeys, orders, products } = await collections();
  const store = await stores.findOne({ slug: storeSlug }, { projection: { _id: 1 } });
  if (!store) return { valid: false, reason: "not_found" };
  const license = await licenseKeys.findOne({ storeId: store._id, key }, { projection: { orderId: 1, productId: 1, revokedAt: 1 } });
  if (!license) return { valid: false, reason: "not_found" };
  const [order, product] = await Promise.all([
    orders.findOne({ _id: license.orderId, storeId: store._id }, { projection: { status: 1 } }),
    products.findOne({ _id: license.productId, storeId: store._id }, { projection: { title: 1 } }),
  ]);
  const status = statusOf(license, order?.status);
  if (status !== "active") return { valid: false, reason: status };
  return { valid: true, product: product?.title ?? "" };
}
