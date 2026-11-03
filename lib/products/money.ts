import { PRICE_MAX_UNITS, STRIPE_MIN_CHARGE, WHOLE_UNIT_CURRENCIES, ZERO_DECIMAL_CURRENCIES, type Currency } from "@/lib/config";

// Money in every store currency (D-046). Amounts are integers in the units Stripe expects
// (docs.stripe.com/currencies): cents for two-decimal currencies, whole units for zero-decimal ones,
// and whole units times 100 for Stripe's special cases (ISK, UGX). Fields named `...Cents` hold these
// units. No floats are stored (CLAUDE.md 5).

const lower = (currency: string) => currency.toLowerCase() as Currency;

/** How many amount units make one whole unit of the currency: 1 for zero-decimal, else 100. */
export function unitsPerWhole(currency: string): 1 | 100 {
  return ZERO_DECIMAL_CURRENCIES.includes(lower(currency)) ? 1 : 100;
}

/** How many decimals a price may have: 0 for zero-decimal and whole-unit currencies, else 2. */
export function priceDecimals(currency: string): 0 | 2 {
  const code = lower(currency);
  return ZERO_DECIMAL_CURRENCIES.includes(code) || WHOLE_UNIT_CURRENCIES.includes(code) ? 0 : 2;
}

/**
 * Parses what a creator or buyer types as a price ("12", "12.50", "$12", "1,500") into amount units
 * for this currency, or null when it is not a valid amount. Fractions are refused where the currency
 * has none (except ".00"). Limits are checked separately (priceLimits).
 */
export function parseMoneyToCents(raw: string, currency: string): number | null {
  // Only a leading currency symbol is dropped ($, £, ¥, ₹...); a minus sign or letters make it invalid.
  const cleaned = raw.trim().replace(/^\p{Sc}\s*/u, "").replace(/[,\s]/g, "");
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const decimals = priceDecimals(currency);
  const fraction = match[2] ?? "";
  if (decimals === 0 && fraction !== "" && Number(fraction) !== 0) return null;
  const whole = Number(match[1]);
  const factor = unitsPerWhole(currency);
  const amount = factor === 1 ? whole : whole * 100 + (decimals === 0 ? 0 : Number(fraction.padEnd(2, "0")));
  return Number.isSafeInteger(amount) ? amount : null;
}

/** Amount units as a plain number for an input: "12.50", or "500" where the currency has no decimals. */
export function centsToInput(cents: number | null | undefined, currency: string): string {
  if (cents === null || cents === undefined) return "";
  return (cents / unitsPerWhole(currency)).toFixed(priceDecimals(currency));
}

/** Amount units as a currency string for display ("$19.99", "¥500", "ISK 5"). */
export function formatMoney(cents: number, currency: string): string {
  const decimals = priceDecimals(currency);
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(cents / unitsPerWhole(currency));
}

/**
 * The smallest paid price and the highest price for a currency, in amount units (D-046): Stripe's
 * minimum charge where Stripe lists one, else one whole unit; the max is Stripe's 8-digit limit.
 * 0 (free) is always allowed on top of these.
 */
export function priceLimits(currency: string): { minPaid: number; max: number } {
  const listed = STRIPE_MIN_CHARGE[lower(currency)];
  return { minPaid: listed ?? unitsPerWhole(currency), max: PRICE_MAX_UNITS };
}

/** Why an amount is not allowed for this currency, or null when it is fine. */
export function priceProblem(cents: number, currency: string, label = "Price"): string | null {
  const { minPaid, max } = priceLimits(currency);
  if (cents > max) return `${label}: the highest amount is ${formatMoney(max, currency)}.`;
  if (cents !== 0 && cents < minPaid) return `${label}: use 0 (free) or at least ${formatMoney(minPaid, currency)}.`;
  // Whole-unit currencies are sent to Stripe as two-decimal amounts ending in 00.
  if (WHOLE_UNIT_CURRENCIES.includes(lower(currency)) && cents % 100 !== 0) return `${label}: use a whole amount.`;
  return null;
}
