import { formatMoney } from "@/lib/products/money";

// A product's price and optional discount (D-047). Buyers pay the discounted price when there is
// one, else the regular price. Amounts are Stripe amount units (D-046). Products saved before D-047
// may still carry the old pay-what-you-want fields; they are ignored, so such a product sells at its
// suggested price, which is also what the migration writes.

export type Priced = { priceCents: number; salePriceCents?: number | null };

/** True when a discount is set and lower than the regular price. */
export function onSale(product: Priced): boolean {
  const sale = product.salePriceCents;
  return sale !== null && sale !== undefined && sale < product.priceCents;
}

/** What the buyer pays. */
export function payableCents(product: Priced): number {
  return onSale(product) ? (product.salePriceCents as number) : product.priceCents;
}

/** How much the discount takes off, 0 without one. */
export function discountCentsOf(product: Priced): number {
  return product.priceCents - payableCents(product);
}

/** The price to show: "Free", "$19.00", or the discounted price ("$19.00", with the regular one struck through by the caller). */
export function priceLabel(product: Priced, currency: string): string {
  const pay = payableCents(product);
  return pay === 0 ? "Free" : formatMoney(pay, currency);
}

/** The regular price to strike through next to a discounted one, or null without a discount. */
export function regularPriceLabel(product: Priced, currency: string): string | null {
  return onSale(product) ? formatMoney(product.priceCents, currency) : null;
}

/** Whole-percent saving for a badge ("Save 34%"), rounded down so it never overstates the discount. */
export function savingPercent(product: Priced): number {
  if (!onSale(product) || product.priceCents === 0) return 0;
  return Math.floor((discountCentsOf(product) / product.priceCents) * 100);
}
