import { discountCentsOf, payableCents, type Priced } from "@/lib/products/pricing";

export type OrderAmounts = { subtotalCents: number; discountCents: number; totalCents: number };

/**
 * What an order charges, computed from the product in the database (D-047): the regular price,
 * the discount when there is one, and the total the buyer pays. Nothing from the client is used,
 * so a buyer cannot choose their own price (CLAUDE.md 7).
 */
export function orderAmounts(product: Priced): OrderAmounts {
  return { subtotalCents: product.priceCents, discountCents: discountCentsOf(product), totalCents: payableCents(product) };
}
