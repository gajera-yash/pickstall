// Uploaded images (D-032). Pure helpers, safe for server and client code.

export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const MEDIA_KINDS = ["avatar", "cover"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;
export type ImageMime = keyof typeof IMAGE_TYPES;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const MEDIA_PATH = new RegExp(`^/media/(${UUID})$`);

/** Public path of an uploaded image. */
export function mediaPath(id: string): string {
  return `/media/${id}`;
}

/** The upload id of an app media path, or null. */
export function mediaIdFromPath(value: string): string | null {
  return MEDIA_PATH.exec(value)?.[1] ?? null;
}

export function isUuid(value: string): boolean {
  return new RegExp(`^${UUID}$`).test(value);
}

/**
 * What an image field may hold: an uploaded image (`/media/<id>`), or an https link kept from
 * before uploads existed (D-032). Anything else (http, data:, javascript:) is not an image.
 */
export function safeImageSrc(value: string | null | undefined): string | null {
  if (!value) return null;
  if (MEDIA_PATH.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/** Absolute URL for Open Graph tags: media paths get the app origin, https links stay as they are. */
export function absoluteImageUrl(value: string | null | undefined, appUrl: string): string | undefined {
  const src = safeImageSrc(value);
  if (!src) return undefined;
  return src.startsWith("/") ? new URL(src, appUrl).href : src;
}

/**
 * The image type of a file from its first bytes (JPEG, PNG, GIF, WebP), or null. The type the
 * browser claims is never trusted, and SVG is not accepted: it can carry scripts.
 */
export function sniffImageType(bytes: Uint8Array): ImageMime | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return "image/gif";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}
