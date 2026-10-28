import { z } from "zod";

/** International format: "+", a country code that does not start with 0, 7 to 15 digits in total. Matches the database check. */
export const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export const PHONE_HINT = "Pick your country code, then type your number.";
export const PHONE_ERROR = "Check the number and the country code.";

/** Removes spaces, dashes, dots and brackets; turns a leading "00" into "+". Does not validate. */
export function normalizePhone(raw: string): string {
  const compact = raw.trim().replace(/[\s().-]/g, "");
  return compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
}

/** Optional phone number: empty becomes undefined; anything else must be in international format. */
export const optionalPhoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((value) => value === "" || E164_PATTERN.test(value), { error: PHONE_ERROR })
  .transform((value) => (value === "" ? undefined : value));

/** Country codes offered next to the phone field. ISO region, dial code without "+", and the name. */
export const DIAL_CODES = [
  { region: "US", dial: "1", name: "United States" },
  { region: "CA", dial: "1", name: "Canada" },
  { region: "GB", dial: "44", name: "United Kingdom" },
  { region: "IN", dial: "91", name: "India" },
  { region: "AU", dial: "61", name: "Australia" },
  { region: "NZ", dial: "64", name: "New Zealand" },
  { region: "IE", dial: "353", name: "Ireland" },
  { region: "AE", dial: "971", name: "United Arab Emirates" },
  { region: "SG", dial: "65", name: "Singapore" },
  { region: "DE", dial: "49", name: "Germany" },
  { region: "FR", dial: "33", name: "France" },
  { region: "NL", dial: "31", name: "Netherlands" },
  { region: "ES", dial: "34", name: "Spain" },
  { region: "IT", dial: "39", name: "Italy" },
  { region: "ZA", dial: "27", name: "South Africa" },
  { region: "NG", dial: "234", name: "Nigeria" },
  { region: "PH", dial: "63", name: "Philippines" },
  { region: "MY", dial: "60", name: "Malaysia" },
  { region: "PK", dial: "92", name: "Pakistan" },
  { region: "BR", dial: "55", name: "Brazil" },
  { region: "MX", dial: "52", name: "Mexico" },
] as const;

export type DialRegion = (typeof DIAL_CODES)[number]["region"];
export const DEFAULT_DIAL_REGION: DialRegion = "US";

/** The listed region of a browser locale such as "en-IN", or the default. */
export function regionFromLocale(locale: string | undefined): DialRegion {
  const region = locale?.split(/[-_]/)[1]?.toUpperCase();
  return DIAL_CODES.find((entry) => entry.region === region)?.region ?? DEFAULT_DIAL_REGION;
}

/**
 * Joins the picked country code and the typed number into one value for the form. A number typed
 * with its own "+" wins; a national leading 0 is dropped. Empty stays empty (the phone is optional).
 * The server still normalizes and validates it (optionalPhoneSchema).
 */
export function composePhone(region: DialRegion, national: string): string {
  const typed = national.trim();
  if (typed === "") return "";
  if (typed.startsWith("+")) return normalizePhone(typed);
  const digits = typed.replace(/\D/g, "").replace(/^0+/, "");
  if (digits === "") return "";
  const dial = DIAL_CODES.find((entry) => entry.region === region)?.dial ?? "1";
  return `+${dial}${digits}`;
}
