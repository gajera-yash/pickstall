import { z } from "zod";

/** International format: "+", a country code that does not start with 0, 7 to 15 digits in total. Matches the database check. */
export const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export const PHONE_HINT = "Include the country code, for example +1 415 555 0100.";

/** Removes spaces, dashes, dots and brackets; turns a leading "00" into "+". Does not validate. */
export function normalizePhone(raw: string): string {
  const compact = raw.trim().replace(/[\s().-]/g, "");
  return compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
}

/** Optional phone number: empty becomes undefined; anything else must be in international format. */
export const optionalPhoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((value) => value === "" || E164_PATTERN.test(value), { error: PHONE_HINT })
  .transform((value) => (value === "" ? undefined : value));
