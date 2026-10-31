import { PRICE_MAX_CENTS } from "@/lib/config";
import type { ProductDoc } from "@/lib/db/collections";
import { parseMoneyToCents } from "@/lib/products/money";

type Priced = Pick<ProductDoc, "pricingModel" | "priceCents" | "minPriceCents">;

export type AmountResult = { ok: true; cents: number } | { ok: false; error: string };

/**
 * The amount to charge, computed from the product in the database. A fixed price ignores whatever
 * the client sent. For pay-what-you-want the client's amount is checked against the creator's
 * minimum and the platform maximum; without one, the suggested price is used.
 */
export function computeAmountCents(product: Priced, requested: string | undefined): AmountResult {
  if (product.pricingModel === "fixed") return { ok: true, cents: product.priceCents };

  const minimum = product.minPriceCents ?? 0;
  const raw = requested?.trim() ?? "";
  if (raw === "") return { ok: true, cents: product.priceCents };

  const cents = parseMoneyToCents(raw);
  if (cents === null) return { ok: false, error: "Enter an amount like 10 or 10.50." };
  if (cents < minimum) return { ok: false, error: `The minimum is ${(minimum / 100).toFixed(2)}.` };
  if (cents > PRICE_MAX_CENTS) return { ok: false, error: `The highest amount is ${PRICE_MAX_CENTS / 100}.` };
  if (cents !== 0 && cents < 100) return { ok: false, error: "Use 0 (free) or at least 1.00." };
  return { ok: true, cents };
}
