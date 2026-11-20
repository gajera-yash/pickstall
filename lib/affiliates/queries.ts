import "server-only";

import { randomUUID } from "node:crypto";

import { AFFILIATE_LIMITS, affiliateCodeOf, type AffiliateInput } from "@/lib/affiliates/rules";
import { collections, type AffiliateDoc, type OrderDoc } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";

// Affiliates (D-113). Creator reads and writes always filter by the `storeId` of requireCreator(),
// never by client input. Checkout looks a code up only inside the store being bought from.

/** The store's affiliates, newest first. */
export async function listAffiliates(storeId: string): Promise<AffiliateDoc[]> {
  const { affiliates } = await collections();
  return affiliates.find({ storeId }).sort({ createdAt: -1 }).limit(AFFILIATE_LIMITS.perStore).toArray();
}

/** Adds an affiliate. "taken" when the store already has that code (the unique index decides), "limit" at the cap. */
export async function createAffiliate(storeId: string, input: AffiliateInput, now: Date = new Date()): Promise<{ id: string } | "taken" | "limit"> {
  const { affiliates } = await collections();
  if ((await affiliates.countDocuments({ storeId })) >= AFFILIATE_LIMITS.perStore) return "limit";
  const doc: AffiliateDoc = {
    _id: randomUUID(),
    storeId,
    name: input.name,
    email: input.email,
    code: input.code,
    codeKey: input.code,
    commissionPercent: input.commissionPercent,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await affiliates.insertOne(doc);
  } catch (error) {
    if (isDuplicateKeyError(error)) return "taken";
    throw error;
  }
  return { id: doc._id };
}

/** Pauses or resumes an affiliate of this store. False when it is not this store's. */
export async function setAffiliateActive(storeId: string, affiliateId: string, active: boolean): Promise<boolean> {
  const { affiliates } = await collections();
  const result = await affiliates.updateOne({ _id: affiliateId, storeId }, { $set: { active, updatedAt: new Date() } });
  return result.matchedCount === 1;
}

/** The order's affiliate for a code used at checkout: only an active affiliate of this store. */
export async function affiliateForCheckout(storeId: string, rawCode: unknown): Promise<NonNullable<OrderDoc["affiliate"]> | null> {
  const code = affiliateCodeOf(rawCode);
  if (!code) return null;
  const { affiliates } = await collections();
  const found = await affiliates.findOne({ storeId, codeKey: code, active: true }, { projection: { code: 1, commissionPercent: 1 } });
  return found ? { affiliateId: found._id, code: found.code, commissionPercent: found.commissionPercent } : null;
}

/** Records a payment the creator made outside the platform. False when the affiliate is not this store's. */
export async function recordAffiliatePayout(
  storeId: string,
  affiliateId: string,
  payout: { amountCents: number; currency: string; note: string | null },
  now: Date = new Date(),
): Promise<boolean> {
  const { affiliates, affiliatePayouts } = await collections();
  if ((await affiliates.countDocuments({ _id: affiliateId, storeId }, { limit: 1 })) !== 1) return false;
  await affiliatePayouts.insertOne({ _id: randomUUID(), storeId, affiliateId, ...payout, createdAt: now });
  return true;
}

export type AffiliateTotals = { orders: number; salesCents: number; commissionCents: number; paidCents: number };

/**
 * Totals per affiliate of this store, in its currency: paid orders (net of partial refunds; a full
 * refund is not "paid"), the commission at each order's frozen rate rounded down per order, and what
 * the creator recorded as paid.
 */
export async function affiliateTotals(storeId: string, currency: string): Promise<Map<string, AffiliateTotals>> {
  const { orders, affiliatePayouts } = await collections();
  const net = { $max: [0, { $subtract: ["$totalCents", { $ifNull: ["$amountRefundedCents", 0] }] }] };
  const [sales, payouts] = await Promise.all([
    orders
      .aggregate<{ _id: string; orders: number; salesCents: number; commissionCents: number }>([
        { $match: { storeId, status: "paid", currency, "affiliate.affiliateId": { $type: "string" }, bumpOf: null } },
        {
          $group: {
            _id: "$affiliate.affiliateId",
            orders: { $sum: 1 },
            salesCents: { $sum: net },
            commissionCents: { $sum: { $floor: { $divide: [{ $multiply: [net, "$affiliate.commissionPercent"] }, 100] } } },
          },
        },
      ])
      .toArray(),
    affiliatePayouts.aggregate<{ _id: string; paidCents: number }>([{ $match: { storeId, currency } }, { $group: { _id: "$affiliateId", paidCents: { $sum: "$amountCents" } } }]).toArray(),
  ]);
  const totals = new Map<string, AffiliateTotals>();
  for (const row of sales) totals.set(row._id, { orders: row.orders, salesCents: row.salesCents, commissionCents: row.commissionCents, paidCents: 0 });
  for (const row of payouts) {
    const current = totals.get(row._id) ?? { orders: 0, salesCents: 0, commissionCents: 0, paidCents: 0 };
    totals.set(row._id, { ...current, paidCents: row.paidCents });
  }
  return totals;
}
