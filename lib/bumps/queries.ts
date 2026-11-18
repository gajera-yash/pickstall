import "server-only";

import { randomUUID } from "node:crypto";

import { BUMP_TYPES, type BumpInput } from "@/lib/bumps/rules";
import { collections, type OrderDoc, type ProductDoc } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";

// Order bumps (D-089). Creator writes filter by the `storeId` of requireCreator(); a bump can only
// name another product of the same store. When an order with a bump is paid (only from the payment
// path), a $0 "bump order" for the bump product is made, so the buyer gets it like any purchase.

const NOT_DELETED = { deletedAt: null };

/** Products of this store that can be offered as a bump for `productId` (not itself, not coaching). */
export async function listBumpCandidates(storeId: string, productId: string): Promise<{ id: string; title: string; status: ProductDoc["status"] }[]> {
  const { products } = await collections();
  const docs = await products
    .find({ storeId, _id: { $ne: productId }, type: { $in: BUMP_TYPES }, status: { $ne: "archived" }, ...NOT_DELETED }, { projection: { title: 1, status: 1 } })
    .sort({ sortOrder: 1 })
    .limit(100)
    .toArray();
  return docs.map((doc) => ({ id: doc._id, title: doc.title, status: doc.status }));
}

/** Saves (or removes, with null) the bump of one product of this store. */
export async function saveProductBump(storeId: string, productId: string, bump: BumpInput): Promise<"saved" | "not_found" | "bad_product"> {
  const { products } = await collections();
  if (bump) {
    if (bump.productId === productId) return "bad_product";
    const target = await products.countDocuments({ _id: bump.productId, storeId, type: { $in: BUMP_TYPES }, ...NOT_DELETED });
    if (target !== 1) return "bad_product";
  }
  const result = await products.updateOne({ _id: productId, storeId, ...NOT_DELETED }, { $set: { bump, updatedAt: new Date() } });
  return result.matchedCount === 1 ? "saved" : "not_found";
}

export type CheckoutBump = { productId: string; title: string; coverUrl: string | null; priceCents: number; headline: string | null };

/**
 * The bump a buyer may add at checkout, or null: set on the product, and the bump product is still
 * this store's, published, not deleted and of a bump type. The price is the one saved on the product.
 */
export async function findCheckoutBump(storeId: string, bump: ProductDoc["bump"] | undefined): Promise<CheckoutBump | null> {
  if (!bump) return null;
  const { products } = await collections();
  const target = await products.findOne({ _id: bump.productId, storeId, status: "published", type: { $in: BUMP_TYPES }, ...NOT_DELETED }, { projection: { title: 1, coverUrl: 1 } });
  return target ? { productId: target._id, title: target.title, coverUrl: target.coverUrl, priceCents: bump.priceCents, headline: bump.headline } : null;
}

/**
 * Makes the $0 bump order of a paid parent order (once: unique `bumpOf`). Returns its id, or null
 * when the order has no bump or is not paid.
 */
export async function createBumpOrder(parentOrderId: string, now: Date = new Date()): Promise<string | null> {
  const { orders } = await collections();
  const parent = await orders.findOne({ _id: parentOrderId, status: "paid" });
  if (!parent?.bump) return null;
  const existing = await orders.findOne({ bumpOf: parentOrderId }, { projection: { _id: 1 } });
  if (existing) return existing._id;
  const doc: OrderDoc = {
    _id: randomUUID(),
    storeId: parent.storeId,
    productId: parent.bump.productId,
    item: { title: parent.bump.title, unitPriceCents: parent.bump.priceCents },
    buyerEmail: parent.buyerEmail,
    buyerName: parent.buyerName,
    buyerPhone: parent.buyerPhone,
    answers: [],
    // Paid as part of the parent order: its money is counted there, not twice.
    subtotalCents: 0,
    discountCents: 0,
    totalCents: 0,
    currency: parent.currency,
    status: "paid",
    provider: parent.provider,
    providerSessionId: null,
    bumpOf: parentOrderId,
    createdAt: now,
    paidAt: parent.paidAt ?? now,
  };
  try {
    await orders.insertOne(doc);
    return doc._id;
  } catch (error) {
    if (!isDuplicateKeyError(error, "bumpOf")) throw error;
    return (await orders.findOne({ bumpOf: parentOrderId }, { projection: { _id: 1 } }))?._id ?? null;
  }
}

/** A fully refunded parent order removes the bump product's access too. */
export async function refundBumpOrder(parentOrderId: string, now: Date = new Date()): Promise<void> {
  const { orders } = await collections();
  await orders.updateOne({ bumpOf: parentOrderId, status: "paid" }, { $set: { status: "refunded", refundedAt: now } });
}
