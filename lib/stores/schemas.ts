import { z } from "zod";

import { AA_TEXT } from "@/lib/contrast";
import { CURRENCIES, SOCIAL_LINK_KINDS, SOCIAL_LINKS_MAX } from "@/lib/config";
import { safeImageSrc } from "@/lib/media/media";
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

/**
 * An uploaded image path (`/media/<id>`, D-032), or an https link kept from before uploads existed.
 * New images come only from the uploader. Empty becomes undefined.
 */
export function imageField(label: string) {
  return z
    .string()
    .trim()
    .max(STORE_URL_MAX_LENGTH, { error: `${label}: use ${STORE_URL_MAX_LENGTH} characters or fewer.` })
    .refine((value) => value === "" || safeImageSrc(value) !== null, { error: `${label}: upload an image from your device.` })
    .transform((value) => (value === "" ? undefined : value));
}

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

/** One social link: a known kind and a required https URL. */
export const socialLinkSchema = z.object({
  kind: z.enum(SOCIAL_LINK_KINDS, { error: "Pick where this link goes." }),
  url: httpsUrlSchema("link").pipe(z.string({ error: "Enter the link, or remove this row." })),
});

export type SocialLink = z.infer<typeof socialLinkSchema>;

export const socialLinksSchema = z
  .array(socialLinkSchema)
  .max(SOCIAL_LINKS_MAX, { error: `Add up to ${SOCIAL_LINKS_MAX} links.` })
  .superRefine((links, ctx) => {
    const seen = new Set<string>();
    links.forEach((link, index) => {
      const key = link.url.toLowerCase();
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: [index, "url"], message: "You already added this link." });
      seen.add(key);
    });
  });

/** Store setup form (D-028): the profile. Slug, theme, Stripe and publish state are never set here. */
export const storeProfileInput = z.object({
  name: storeNameSchema,
  bio: storeBioSchema,
  avatarUrl: imageField("Photo"),
  currency: z.enum(CURRENCIES, { error: "Pick a currency." }),
  socialLinks: socialLinksSchema,
});

export type StoreProfileInput = z.infer<typeof storeProfileInput>;

/** Page design tab on My Store (PRD F8): theme preset and accent. */
export const pageDesignInput = z.object({
  themePreset: z.enum(THEME_PRESET_IDS, { error: "Pick a theme." }),
  accent: accentSchema,
});

export type PageDesignInput = z.infer<typeof pageDesignInput>;

/**
 * Social link rows from a form (`socialKind` and `socialUrl`, one pair per row). Rows with an
 * empty URL are dropped, so an added but unused row is not an error. `rows` maps each kept link
 * back to its row on screen, for error messages.
 */
export function socialLinkRowsFromForm(formData: FormData): { links: { kind: unknown; url: unknown }[]; rows: number[] } {
  const kinds = formData.getAll("socialKind");
  const urls = formData.getAll("socialUrl");
  const links: { kind: unknown; url: unknown }[] = [];
  const rows: number[] = [];
  // Never read more rows than the limit allows (plus one, so the max error can still show).
  const count = Math.min(Math.max(kinds.length, urls.length), SOCIAL_LINKS_MAX + 1);
  for (let row = 0; row < count; row++) {
    const url = urls[row];
    if (typeof url !== "string" || url.trim() === "") continue;
    links.push({ kind: kinds[row], url });
    rows.push(row);
  }
  return { links, rows };
}
