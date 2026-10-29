import { getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import { z } from "zod";

/** International format: "+", a country code that does not start with 0, 7 to 15 digits in total. */
export const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export const PHONE_HINT = "Pick your country, then type your number.";
export const PHONE_ERROR = "Check the number and the country code.";

/** Removes spaces, dashes, dots and brackets; turns a leading "00" into "+". Does not validate. */
export function normalizePhone(raw: string): string {
  const compact = raw.trim().replace(/[\s().-]/g, "");
  return compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
}

/**
 * Optional phone number: empty becomes undefined; anything else must be in international format
 * and a real number for its country (libphonenumber metadata).
 */
export const optionalPhoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((value) => value === "" || (E164_PATTERN.test(value) && isValidPhoneNumber(value)), { error: PHONE_ERROR })
  .transform((value) => (value === "" ? undefined : value));

export type PhoneCountry = CountryCode;
export type PhoneCountryOption = { country: PhoneCountry; dial: string; name: string };

export const DEFAULT_PHONE_COUNTRY: PhoneCountry = "US";

const COUNTRIES = new Set<string>(getCountries());

function isPhoneCountry(value: string | undefined): value is PhoneCountry {
  return value !== undefined && COUNTRIES.has(value);
}

/** Every country with its dial code and English name, sorted by name, for the country picker. */
export function phoneCountryOptions(): PhoneCountryOption[] {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  return getCountries()
    .map((country) => ({ country, dial: getCountryCallingCode(country), name: names.of(country) ?? country }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/** The country of a browser locale such as "en-IN", or the default. */
export function countryFromLocale(locale: string | undefined): PhoneCountry {
  const region = locale?.split(/[-_]/)[1]?.toUpperCase();
  return isPhoneCountry(region) ? region : DEFAULT_PHONE_COUNTRY;
}

/**
 * Joins the picked country and the typed number into one value for the form. A number typed
 * with its own "+" wins; a national leading 0 is dropped. Empty stays empty (the phone is optional).
 * The server still normalizes and validates it (optionalPhoneSchema).
 */
export function composePhone(country: PhoneCountry, national: string): string {
  const typed = national.trim();
  if (typed === "") return "";
  if (typed.startsWith("+")) return normalizePhone(typed);
  const digits = typed.replace(/\D/g, "").replace(/^0+/, "");
  if (digits === "") return "";
  return `+${getCountryCallingCode(country)}${digits}`;
}

/** Splits a saved international number into the picker's country and the national number, or null. */
export function splitPhone(value: string | null | undefined): { country: PhoneCountry; national: string } | null {
  if (!value) return null;
  const parsed = parsePhoneNumberFromString(value);
  if (!parsed?.country || !isPhoneCountry(parsed.country)) return null;
  return { country: parsed.country, national: parsed.nationalNumber };
}
