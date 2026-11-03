import type { ProductDoc } from "@/lib/db/collections";
import { formatMoney, parseMoneyToCents, priceDecimals, priceProblem } from "@/lib/products/money";

type Priced = Pick<ProductDoc, "pricingModel" | "priceCents" | "minPriceCents">;

export type AmountResult = { ok: true; cents: number } | { ok: false; error: string };

/**
 * The amount to charge, computed from the product in the database. A fixed price ignores whatever
 * the client sent. For pay-what-you-want the client's amount is checked against the creator's
 * minimum and Stripe's limits for the store currency (D-046); without one, the suggested price is used.
 */
export function computeAmountCents(product: Priced, requested: string | undefined, currency: string): AmountResult {
  if (product.pricingModel === "fixed") return { ok: true, cents: product.priceCents };

  const minimum = product.minPriceCents ?? 0;
  const raw = requested?.trim() ?? "";
  if (raw === "") return { ok: true, cents: product.priceCents };

  const cents = parseMoneyToCents(raw, currency);
  if (cents === null) return { ok: false, error: priceDecimals(currency) === 0 ? "Enter a whole amount like 500." : "Enter an amount like 10 or 10.50." };
  if (cents < minimum) return { ok: false, error: `The minimum is ${formatMoney(minimum, currency)}.` };
  const problem = priceProblem(cents, currency, "Amount");
  if (problem) return { ok: false, error: problem };
  return { ok: true, cents };
}
