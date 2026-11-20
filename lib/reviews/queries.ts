import "server-only";

import { randomUUID } from "node:crypto";

import { collections, type ReviewDoc } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { isUuid } from "@/lib/media/media";
import type { PublicReview } from "@/lib/reviews/public";
import { shortName } from "@/lib/reviews/rules";

// Product reviews (D-106). Buyers write only for their own paid order (matched by the signed-in
// email); creators read and change only their own store's reviews (store id from the session);
// the public sees only published reviews with the short name, never an email.

export type { PublicReview };
export type CreatorReview = PublicReview & { productId: string; productTitle: string; status: ReviewDoc["status"] };

const normalize = (email: string) => email.trim().toLowerCase();

/** The signed-in buyer's own review for this order's product, or null. */
export async function findOwnReview(email: string, orderId: string): Promise<{ rating: number; text: string | null } | null> {
  if (!isUuid(orderId)) return null;
  const { orders, reviews } = await collections();
  const order = await orders.findOne({ _id: orderId, buyerEmail: normalize(email) }, { projection: { storeId: 1, productId: 1 } });
  if (!order) return null;
  const review = await reviews.findOne({ storeId: order.storeId, productId: order.productId, buyerKey: normalize(email) }, { projection: { rating: 1, text: 1 } });
  return review ? { rating: review.rating, text: review.text } : null;
}

/**
 * Saves the buyer's review of the product of their order: the order must be theirs (signed-in
 * email) and paid (not refunded). One review per buyer and product: saving again updates it, and
 * a review the creator hid stays hidden.
 */
export async function saveReview(email: string, orderId: string, input: { rating: number; text: string | null }, now: Date = new Date()): Promise<"saved" | "not_found"> {
  if (!isUuid(orderId)) return "not_found";
  const { orders, reviews } = await collections();
  const buyerKey = normalize(email);
  const order = await orders.findOne({ _id: orderId, buyerEmail: buyerKey, status: "paid" }, { projection: { storeId: 1, productId: 1, buyerName: 1 } });
  if (!order) return "not_found";
  const filter = { storeId: order.storeId, productId: order.productId, buyerKey };
  const set = { rating: input.rating as ReviewDoc["rating"], text: input.text, updatedAt: now };
  const insert = { _id: randomUUID(), orderId, buyerName: shortName(order.buyerName), status: "published" as const, createdAt: now };
  try {
    await reviews.updateOne(filter, { $set: set, $setOnInsert: insert }, { upsert: true });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    await reviews.updateOne(filter, { $set: set });
  }
  return "saved";
}

/** Every review of the session owner's store, newest first, with product titles. */
export async function listStoreReviews(storeId: string, limit = 200): Promise<CreatorReview[]> {
  const { reviews, products } = await collections();
  const docs = await reviews.find({ storeId }).sort({ createdAt: -1 }).limit(limit).toArray();
  const titles = new Map((await products.find({ storeId, _id: { $in: [...new Set(docs.map((doc) => doc.productId))] } }, { projection: { title: 1 } }).toArray()).map((product) => [product._id, product.title]));
  return docs.map((doc) => ({ id: doc._id, productId: doc.productId, productTitle: titles.get(doc.productId) ?? "Deleted product", buyerName: doc.buyerName, rating: doc.rating, text: doc.text, status: doc.status, createdAt: doc.createdAt }));
}

/** Shows or hides a review of the session owner's store. False when it is not this store's. */
export async function setReviewStatus(storeId: string, reviewId: string, status: ReviewDoc["status"]): Promise<boolean> {
  const { reviews } = await collections();
  const result = await reviews.updateOne({ _id: reviewId, storeId }, { $set: { status, updatedAt: new Date() } });
  return result.matchedCount === 1;
}

/** Deletes a review of the session owner's store. */
export async function deleteReview(storeId: string, reviewId: string): Promise<boolean> {
  const { reviews } = await collections();
  return (await reviews.deleteOne({ _id: reviewId, storeId })).deletedCount === 1;
}
