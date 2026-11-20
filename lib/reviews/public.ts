import "server-only";

import { collections } from "@/lib/db/collections";
import { roundRating, type RatingSummary } from "@/lib/reviews/rules";

// Public review reads (D-106): only published reviews, with the short name, never an email. Kept
// apart from lib/reviews/queries.ts so the public store pages load as little as possible.

export type PublicReview = { id: string; buyerName: string; rating: number; text: string | null; createdAt: Date };

/** Average and count of published reviews for these products of a store. */
export async function ratingSummaries(storeId: string, productIds: string[]): Promise<Map<string, RatingSummary>> {
  if (productIds.length === 0) return new Map();
  const { reviews } = await collections();
  const rows = await reviews
    .aggregate<{ _id: string; average: number; count: number }>([
      { $match: { storeId, productId: { $in: productIds }, status: "published" } },
      { $group: { _id: "$productId", average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((row) => [row._id, { average: roundRating(row.average), count: row.count }]));
}

/** The latest published reviews of one product. */
export async function listProductReviews(storeId: string, productId: string, limit = 20): Promise<PublicReview[]> {
  const { reviews } = await collections();
  const docs = await reviews.find({ storeId, productId, status: "published" }, { projection: { buyerName: 1, rating: 1, text: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs.map((doc) => ({ id: doc._id, buyerName: doc.buyerName, rating: doc.rating, text: doc.text, createdAt: doc.createdAt }));
}

