import { z } from "zod";

import type { CouponDoc } from "@/lib/db/collections";
import { formatMoney, parseMoneyToCents, priceLimits } from "@/lib/products/money";

// Coupon rules (D-088). Pure and client-safe: the creator form, the checkout preview and the server
// all use the same math. The server always recomputes from the database; a client amount is never used.

export const COUPON_CODE = /^[A-Z0-9][A-Z0-9_-]{2,19}$/;
export const COUPONS_MAX_PER_STORE = 200;

/** "  diwali20 " -> "DIWALI20". */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export type CouponTerms = Pick<CouponDoc, "kind" | "percentOff" | "amountOffCents">;

/**
 * How much a coupon takes off a price the buyer would otherwise pay (after any sale price): a
 * percentage rounded down to whole units, or a fixed amount, never more than the price.
 */
export function couponDiscountCents(payable: number, coupon: CouponTerms): number {
  if (payable <= 0) return 0;
  const off = coupon.kind === "percent" ? Math.floor((payable * (coupon.percentOff ?? 0)) / 100) : (coupon.amountOffCents ?? 0);
  return Math.max(0, Math.min(payable, off));
}

export type CouponCheck = Pick<CouponDoc, "active" | "expiresAt" | "productIds" | "maxRedemptions" | "redemptionCount">;

/** Why a coupon cannot be used on this product now, in the buyer's words, or null when it can. */
export function couponProblem(coupon: CouponCheck | null, productId: string, now: Date): string | null {
  if (!coupon || !coupon.active) return "This code isn't valid.";
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) return "This code has expired.";
  if (coupon.productIds && !coupon.productIds.includes(productId)) return "This code doesn't work for this product.";
  if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) return "This code has been used up.";
  return null;
}

/**
 * A paid total must be 0 (free) or at least Stripe's minimum charge for the currency (D-046), so a
 * coupon that leaves a few cents is refused instead of failing at the payment step.
 */
export function totalProblem(total: number, currency: string): string | null {
  if (total === 0) return null;
  const { minPaid } = priceLimits(currency);
  return total < minPaid ? `With this code the price would be below the minimum charge of ${formatMoney(minPaid, currency)}.` : null;
}

/** "20% off" or "$5.00 off". */
export function couponLabel(coupon: CouponTerms, currency: string): string {
  return coupon.kind === "percent" ? `${coupon.percentOff}% off` : `${formatMoney(coupon.amountOffCents ?? 0, currency)} off`;
}

/** The creator's new coupon form, checked again on the server. Amounts in the store's currency. */
export const couponInputFor = (currency: string) =>
  z
    .object({
      code: z
        .string()
        .max(40)
        .transform(normalizeCode)
        .refine((value) => COUPON_CODE.test(value), { error: "Use 3 to 20 letters, numbers, - or _ (no spaces)." }),
      kind: z.enum(["percent", "amount"], { error: "Pick percent or amount." }),
      percentOff: z.string().max(5),
      amountOff: z.string().max(20),
      productIds: z.array(z.uuid()).max(100).nullable(),
      maxRedemptions: z.string().max(7),
      oncePerEmail: z.boolean(),
      expiresAt: z.string().max(40),
    })
    .transform((input, ctx) => {
      let percentOff: number | null = null;
      let amountOffCents: number | null = null;
      if (input.kind === "percent") {
        const value = /^\d{1,3}$/.test(input.percentOff.trim()) ? Number(input.percentOff.trim()) : NaN;
        if (!(value >= 1 && value <= 100)) {
          ctx.addIssue({ code: "custom", path: ["percentOff"], message: "Enter a percentage from 1 to 100." });
          return z.NEVER;
        }
        percentOff = value;
      } else {
        const cents = parseMoneyToCents(input.amountOff, currency);
        if (cents === null || cents <= 0 || cents > priceLimits(currency).max) {
          ctx.addIssue({ code: "custom", path: ["amountOff"], message: "Enter an amount above 0." });
          return z.NEVER;
        }
        amountOffCents = cents;
      }

      let maxRedemptions: number | null = null;
      if (input.maxRedemptions.trim() !== "") {
        const value = /^\d{1,6}$/.test(input.maxRedemptions.trim()) ? Number(input.maxRedemptions.trim()) : NaN;
        if (!(value >= 1)) {
          ctx.addIssue({ code: "custom", path: ["maxRedemptions"], message: "Enter a whole number of uses, or leave it empty for no limit." });
          return z.NEVER;
        }
        maxRedemptions = value;
      }

      let expiresAt: Date | null = null;
      if (input.expiresAt.trim() !== "") {
        const time = Date.parse(input.expiresAt);
        if (!Number.isFinite(time)) {
          ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "Pick a valid end date." });
          return z.NEVER;
        }
        expiresAt = new Date(time);
      }

      const productIds = input.productIds && input.productIds.length > 0 ? [...new Set(input.productIds)] : null;
      return { code: input.code, kind: input.kind, percentOff, amountOffCents, productIds, maxRedemptions, oncePerEmail: input.oncePerEmail, expiresAt };
    });

export type CouponInput = z.infer<ReturnType<typeof couponInputFor>>;
