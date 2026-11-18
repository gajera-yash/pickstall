import { discountCentsOf, payableCents, type Priced } from "@/lib/products/pricing";

export type OrderAmounts = { subtotalCents: number; discountCents: number; totalCents: number };

/**
 * What an order charges, computed from the product in the database (D-047): the regular price,
 * the discount when there is one, and the total the buyer pays. Nothing from the client is used,
 * so a buyer cannot choose their own price (CLAUDE.md 7).
 */
export function orderAmounts(product: Priced, couponDiscountCents = 0): OrderAmounts {
  // A coupon (D-088) comes off what the buyer would otherwise pay, never below 0. The caller
  // computes it on the server from the coupon in the database.
  const payable = payableCents(product);
  const coupon = Math.max(0, Math.min(payable, couponDiscountCents));
  return { subtotalCents: product.priceCents, discountCents: discountCentsOf(product) + coupon, totalCents: payable - coupon };
}
