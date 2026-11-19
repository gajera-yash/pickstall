import { z } from "zod";

import { AA_TEXT } from "@/lib/contrast";
import { emailSchema } from "@/lib/auth/schemas";
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

/** True for a full https link with a real host and no user name or password (D-014). */
export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.hostname.includes(".") && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** The message for a link that is not a full https link. */
export const httpsUrlMessage = (label: string) => `Enter a full ${label} that starts with https://`;

/** Optional https URL (D-014: no http, no javascript: or data: links). Empty becomes undefined. */
export function httpsUrlSchema(label: string) {
  return z
    .string()
    .trim()
    .max(STORE_URL_MAX_LENGTH, { error: `Use ${STORE_URL_MAX_LENGTH} characters or fewer.` })
    .refine((value) => value === "" || isHttpsUrl(value), { error: httpsUrlMessage(label) })
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

/**
 * One stored social link: a known kind and its link. Email links are `mailto:` with a valid
 * address; every other link is https only (D-014). The form builds these from usernames
 * (lib/stores/social-handles.ts); this checks them again before they are saved.
 */
export const socialLinkSchema = z
  .object({
    kind: z.enum(SOCIAL_LINK_KINDS, { error: "Pick where this link goes." }),
    url: z.string({ error: "Enter the link, or leave the row empty." }).trim().min(1).max(STORE_URL_MAX_LENGTH),
  })
  .superRefine((link, ctx) => {
    if (link.kind === "email") {
      const email = link.url.toLowerCase().startsWith("mailto:") ? link.url.slice("mailto:".length) : "";
      if (!emailSchema.safeParse(email).success) ctx.addIssue({ code: "custom", path: ["url"], message: "Enter a valid email address." });
      return;
    }
    if (!httpsUrlSchema("link").safeParse(link.url).success) ctx.addIssue({ code: "custom", path: ["url"], message: "Enter a full link that starts with https://" });
  });

export type SocialLink = z.infer<typeof socialLinkSchema>;

export const socialLinksSchema = z
  .array(socialLinkSchema)
  .max(SOCIAL_LINKS_MAX, { error: `Add up to ${SOCIAL_LINKS_MAX} links.` })
  .superRefine((links, ctx) => {
    const seen = new Set<string>();
    const kinds = new Set<string>();
    links.forEach((link, index) => {
      const key = link.url.toLowerCase();
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: [index, "url"], message: "You already added this link." });
      if (kinds.has(link.kind)) ctx.addIssue({ code: "custom", path: [index, "kind"], message: "Add one link per platform." });
      seen.add(key);
      kinds.add(link.kind);
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
