import { z } from "zod";

// Store pixels (D-097). Creators give IDs only; our own fixed snippets use them. The checks are
// strict character sets, so an ID can never carry script or markup into a page. (Meta does not
// document its ID length; Google documents no prefix list on its install page. These patterns
// cover the IDs both vendors show in their dashboards.)

export const META_PIXEL_ID = /^\d{6,20}$/;
export const GOOGLE_TAG_ID = /^(G|AW|GT|DC)-[A-Z0-9]{4,20}$/;

export type StorePixels = { metaPixelId: string | null; googleTagId: string | null };

const optionalId = (pattern: RegExp, message: string) =>
  z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, ""))
    .refine((value) => value === "" || pattern.test(value), { error: message })
    .transform((value) => (value === "" ? null : value));

export const pixelsInput = z.object({
  metaPixelId: optionalId(META_PIXEL_ID, "A Meta Pixel ID is only digits, like 123456789012345."),
  googleTagId: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .pipe(optionalId(GOOGLE_TAG_ID, "A Google tag ID looks like G-ABC123XYZ or AW-123456789.")),
});

/** True when the store has at least one pixel. */
export function hasPixels(pixels: StorePixels | null | undefined): pixels is StorePixels {
  return Boolean(pixels && (pixels.metaPixelId || pixels.googleTagId));
}

/** Only well-formed IDs ever reach a page, whatever is stored. */
export function safePixels(pixels: StorePixels | null | undefined): StorePixels | null {
  const meta = pixels?.metaPixelId && META_PIXEL_ID.test(pixels.metaPixelId) ? pixels.metaPixelId : null;
  const google = pixels?.googleTagId && GOOGLE_TAG_ID.test(pixels.googleTagId) ? pixels.googleTagId : null;
  return meta || google ? { metaPixelId: meta, googleTagId: google } : null;
}

/** An amount in the currency's main unit for pixel events (integer cents in, number out). */
export function pixelValue(cents: number, decimals: 0 | 2): number {
  return decimals === 0 ? cents : Math.round(cents) / 100;
}
