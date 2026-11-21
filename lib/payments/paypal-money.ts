import { PAYPAL_CURRENCIES } from "@/lib/config";
import { priceDecimals } from "@/lib/products/money";

// Our amounts are integer units (cents, or whole yen) per currency (D-046); PayPal takes a decimal
// string with the currency's own decimals ("19.99", "500" for JPY). Pure, so it is unit-tested.

export function paypalSupportsCurrency(currency: string): boolean {
  return (PAYPAL_CURRENCIES as readonly string[]).includes(currency.toLowerCase());
}

/** Our integer amount as PayPal's value string. */
export function toPayPalValue(amount: number, currency: string): string {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Amount must be a whole number of units.");
  if (priceDecimals(currency) === 0) return String(amount);
  return `${Math.trunc(amount / 100)}.${String(amount % 100).padStart(2, "0")}`;
}

/** PayPal's value string as our integer amount, or null when it is not a valid amount for the currency. */
export function fromPayPalValue(value: string, currency: string): number | null {
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = match[2] ?? "";
  if (priceDecimals(currency) === 0) return fraction === "" || Number(fraction) === 0 ? whole : null;
  const amount = whole * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}
