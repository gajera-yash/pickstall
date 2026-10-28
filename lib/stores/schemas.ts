import { z } from "zod";

import { AA_TEXT } from "@/lib/contrast";
import { CURRENCIES } from "@/lib/config";
import { hasControlChar } from "@/lib/text";
import { THEME_PRESET_IDS, onAccentFor } from "@/lib/themes";

export const STORE_NAME_MAX_LENGTH = 60;
export const STORE_BIO_MAX_LENGTH = 200;
export const STORE_URL_MAX_LENGTH = 500;

export const storeNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter a store name." })
  .max(STORE_NAME_MAX_LENGTH, { error: `Use ${STORE_NAME_MAX_LENGTH} characters or fewer.` })
  .refine((value) => !hasControlChar(value), { error: "Remove the special characters from the name." });

/** Optional short bio. Line breaks are allowed; empty becomes undefined. */
export const storeBioSchema = z
  .string()
  .trim()
  .max(STORE_BIO_MAX_LENGTH, { error: `Use ${STORE_BIO_MAX_LENGTH} characters or fewer.` })
  .refine((value) => !hasControlChar(value, { allowNewlines: true }), { error: "Remove the special characters from the bio." })
  .transform((value) => (value === "" ? undefined : value));

/** Optional https URL (D-014: no http, no javascript: or data: links). Empty becomes undefined. */
export function httpsUrlSchema(label: string) {
  return z
    .string()
    .trim()
    .max(STORE_URL_MAX_LENGTH, { error: `Use ${STORE_URL_MAX_LENGTH} characters or fewer.` })
    .refine(
      (value) => {
        if (value === "") return true;
        try {
          const url = new URL(value);
          return url.protocol === "https:" && url.hostname.includes(".") && !url.username && !url.password;
        } catch {
          return false;
        }
      },
      { error: `Enter a full ${label} that starts with https://` },
    )
    .transform((value) => (value === "" ? undefined : value));
}

export const accentSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, { error: "Pick a color." })
  .transform((value) => value.toUpperCase())
  .refine((value) => onAccentFor(value).ratio >= AA_TEXT, {
    error: "This color is too light or too dark for button text. Pick a stronger color.",
  });

/** Store setup form (PHASE1_PLAN.md B4). Slug, Stripe and publish state are never set here. */
export const storeSetupInput = z.object({
  name: storeNameSchema,
  bio: storeBioSchema,
  avatarUrl: httpsUrlSchema("image link"),
  link: httpsUrlSchema("link"),
  currency: z.enum(CURRENCIES, { error: "Pick a currency." }),
  themePreset: z.enum(THEME_PRESET_IDS, { error: "Pick a theme." }),
  accent: accentSchema,
});

export type StoreSetupInput = z.infer<typeof storeSetupInput>;
