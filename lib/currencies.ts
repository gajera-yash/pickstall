import { CURRENCIES, type Currency } from "@/lib/config";

// Names and flags for the currency picker (D-046). Names come from the runtime's own ISO data
// (Intl.DisplayNames), so there is no hand-kept list to drift.

const names = new Intl.DisplayNames(["en"], { type: "currency" });

/** "US Dollar", "Japanese Yen"; the code itself if the runtime has no name for it. */
export function currencyName(code: string): string {
  return names.of(code.toUpperCase()) ?? code.toUpperCase();
}

/** Currencies shared by several countries: they get a neutral globe instead of one country's flag. */
const SHARED = new Set<string>(["ang", "xaf", "xcd", "xcg", "xof", "xpf"]);

/**
 * The flag to show next to a currency: the EU flag for the euro, none for shared currencies, else
 * the country from the first two letters of the ISO code (USD -> US, INR -> IN).
 */
export function flagCountryFor(code: string): string | null {
  const lower = code.toLowerCase();
  if (lower === "eur") return "EU";
  if (SHARED.has(lower)) return null;
  return lower.slice(0, 2).toUpperCase();
}

export type CurrencyOption = { code: Currency; name: string; flag: string | null };

/** Every store currency, sorted by name, with the launch markets (USD, GBP, CAD) first. */
export function currencyOptions(): CurrencyOption[] {
  const first: readonly string[] = ["usd", "gbp", "cad"];
  return CURRENCIES.map((code) => ({ code, name: currencyName(code), flag: flagCountryFor(code) })).sort((a, b) => {
    const rank = (option: CurrencyOption) => (first.includes(option.code) ? first.indexOf(option.code) : first.length);
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });
}
