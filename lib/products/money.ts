/**
 * Parses what a creator types as a price ("12", "12.5", "12.50", "$12") into integer cents, or null
 * when it is not a valid amount. Money is always integer cents (CLAUDE.md 5); no floats are stored.
 */
export function parseMoneyToCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/^[$£€]\s*/, "").replace(/,/g, "");
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  return whole * 100 + fraction;
}

/** Cents as a plain decimal for an input ("1250" becomes "12.50"). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

/** Cents as a currency string for display. */
export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}
