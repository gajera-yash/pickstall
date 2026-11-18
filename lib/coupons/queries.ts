import "server-only";

import { randomUUID } from "node:crypto";

import { COUPONS_MAX_PER_STORE, couponLabel, normalizeCode, type CouponInput } from "@/lib/coupons/rules";
import { collections, type CouponDoc } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";

// Coupons (D-088). Creator reads and writes always filter by the `storeId` of requireCreator(),
// never by client input. A use is held atomically at checkout (so the limit is never exceeded),
// redeemed when the order is paid (only from the payment path), and released when it fails.

/** The store's coupons, newest first. */
export async function listCoupons(storeId: string): Promise<CouponDoc[]> {
  const { coupons } = await collections();
  return coupons.find({ storeId }).sort({ createdAt: -1 }).limit(COUPONS_MAX_PER_STORE).toArray();
}

/** Creates a coupon for this store. "taken" when the store already has that code, "limit" at the cap. */
export async function createCoupon(storeId: string, input: CouponInput, now: Date = new Date()): Promise<{ id: string } | "taken" | "limit" | "bad_products"> {
  const { coupons, products } = await collections();
  if ((await coupons.countDocuments({ storeId })) >= COUPONS_MAX_PER_STORE) return "limit";
  // Only this store's own products can be named.
  if (input.productIds) {
    const owned = await products.countDocuments({ storeId, _id: { $in: input.productIds }, deletedAt: null });
    if (owned !== input.productIds.length) return "bad_products";
  }
  const doc: CouponDoc = {
    _id: randomUUID(),
    storeId,
    code: input.code,
    codeKey: normalizeCode(input.code),
    kind: input.kind,
    percentOff: input.percentOff,
    amountOffCents: input.amountOffCents,
    productIds: input.productIds,
    maxRedemptions: input.maxRedemptions,
    redemptionCount: 0,
    oncePerEmail: input.oncePerEmail,
    expiresAt: input.expiresAt,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await coupons.insertOne(doc);
  } catch (error) {
    if (isDuplicateKeyError(error)) return "taken";
    throw error;
  }
  return { id: doc._id };
}

/** Turns a coupon of this store on or off. False when it is not this store's. */
export async function setCouponActive(storeId: string, couponId: string, active: boolean): Promise<boolean> {
  const { coupons } = await collections();
  const result = await coupons.updateOne({ _id: couponId, storeId }, { $set: { active, updatedAt: new Date() } });
  return result.matchedCount === 1;
}

/** A coupon of this store by its code (any case), or null. */
export async function findCouponByCode(storeId: string, code: string): Promise<CouponDoc | null> {
  const key = normalizeCode(code);
  if (!key || key.length > 20) return null;
  const { coupons } = await collections();
  return coupons.findOne({ storeId, codeKey: key });
}

/**
 * Holds one use of a coupon for a pending order. The count goes up only if the coupon is still
 * active, unexpired and under its limit (one atomic update), and a once-per-email coupon refuses a
 * second active use of the same email (unique index). On a refusal nothing is held.
 */
export async function holdCoupon(input: { storeId: string; couponId: string; orderId: string; email: string }, now: Date = new Date()): Promise<"held" | "used_up" | "already_used"> {
  const { coupons, couponRedemptions } = await collections();
  const coupon = await coupons.findOneAndUpdate(
    {
      _id: input.couponId,
      storeId: input.storeId,
      active: true,
      $and: [
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
        { $or: [{ maxRedemptions: null }, { $expr: { $lt: ["$redemptionCount", "$maxRedemptions"] } }] },
      ],
    },
    { $inc: { redemptionCount: 1 }, $set: { updatedAt: now } },
    { returnDocument: "after", projection: { oncePerEmail: 1 } },
  );
  if (!coupon) return "used_up";

  try {
    await couponRedemptions.insertOne({
      _id: randomUUID(),
      storeId: input.storeId,
      couponId: input.couponId,
      orderId: input.orderId,
      status: "held",
      activeEmailKey: coupon.oncePerEmail ? `${input.couponId}|${input.email.trim().toLowerCase()}` : null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    // Give the use back: this email already has one, or this order already holds one.
    await coupons.updateOne({ _id: input.couponId }, { $inc: { redemptionCount: -1 } });
    if (isDuplicateKeyError(error, "activeEmailKey")) return "already_used";
    throw error;
  }
  return "held";
}

/** Gives back a pending order's coupon use (payment failed or expired, or the checkout broke). */
export async function releaseCouponForOrder(orderId: string, now: Date = new Date()): Promise<void> {
  const { coupons, couponRedemptions } = await collections();
  const released = await couponRedemptions.findOneAndUpdate({ orderId, status: "held" }, { $set: { status: "released", activeEmailKey: null, updatedAt: now } }, { projection: { couponId: 1 } });
  if (released) await coupons.updateOne({ _id: released.couponId, redemptionCount: { $gt: 0 } }, { $inc: { redemptionCount: -1 } });
}

/** Marks a paid order's coupon use as redeemed. Idempotent; only the payment path calls it. */
export async function redeemCouponForOrder(orderId: string, now: Date = new Date()): Promise<void> {
  const { couponRedemptions } = await collections();
  await couponRedemptions.updateOne({ orderId, status: "held" }, { $set: { status: "redeemed", updatedAt: now } });
}

/** The coupons as the Marketing page lists them: discount, products, uses and end date. */
export function couponRows(
  coupons: CouponDoc[],
  products: { _id: string; title: string }[],
  currency: string,
  now: Date = new Date(),
): { id: string; code: string; label: string; products: string; uses: string; ends: string | null; expired: boolean; active: boolean }[] {
  const titleById = new Map(products.map((product) => [product._id, product.title]));
  const day = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
  return coupons.map((coupon) => ({
    id: coupon._id,
    code: coupon.code,
    label: couponLabel(coupon, currency),
    products: coupon.productIds ? coupon.productIds.map((id) => titleById.get(id) ?? "Removed product").join(", ") : "All products",
    uses: coupon.maxRedemptions === null ? `${coupon.redemptionCount} used` : `${coupon.redemptionCount} of ${coupon.maxRedemptions} used`,
    ends: coupon.expiresAt ? day.format(coupon.expiresAt) : null,
    expired: coupon.expiresAt !== null && coupon.expiresAt.getTime() <= now.getTime(),
    active: coupon.active,
  }));
}
