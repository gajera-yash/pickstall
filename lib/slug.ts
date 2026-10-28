import { z } from "zod";

import { RESERVED_SLUGS } from "@/lib/config";

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 30;

export const SLUG_TAKEN_MESSAGE = "That username is taken. Try another.";

/** True for names we keep for the app itself (app, www, api, ...). Case-insensitive. */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}

/**
 * Cleans what the user types into the username field as they type: lowercase, spaces and
 * underscores become hyphens, everything else that is not a letter, number or hyphen is dropped.
 */
export function normalizeSlugInput(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, SLUG_MAX_LENGTH);
}

/**
 * A store username becomes a web address ({slug}.ROOT_DOMAIN), so it must be a valid host label.
 * This is stricter than the database check (^[a-z0-9-]{3,30}$): no leading or trailing hyphen.
 * Reserved names get the same message as taken ones, so the reserved list is not spelled out.
 */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(SLUG_MIN_LENGTH, { error: `Use ${SLUG_MIN_LENGTH} to ${SLUG_MAX_LENGTH} characters.` })
  .max(SLUG_MAX_LENGTH, { error: `Use ${SLUG_MIN_LENGTH} to ${SLUG_MAX_LENGTH} characters.` })
  .regex(/^[a-z0-9-]+$/, { error: "Use only letters, numbers and hyphens." })
  .regex(/^[a-z0-9].*[a-z0-9]$/, { error: "Start and end with a letter or number." })
  // "xx--" in positions 3-4 is reserved for internationalized domain names.
  .refine((slug) => slug.slice(2, 4) !== "--", { error: "Use only letters, numbers and single hyphens." })
  .refine((slug) => !isReservedSlug(slug), { error: SLUG_TAKEN_MESSAGE });

const SUGGESTION_PATTERNS: readonly ((base: string) => string)[] = [
  (base) => `${base}-official`,
  (base) => `${base}-store`,
  (base) => `hey-${base}`,
  (base) => `${base}-shop`,
  (base) => `the-${base}`,
  (base) => `${base}-hq`,
  (base) => `${base}-studio`,
  (base) => `${base}-co`,
];

/**
 * Other usernames to offer when one is taken, in order of preference. Every candidate passes
 * slugSchema (length, characters, reserved names); availability is checked on the server.
 */
export function usernameCandidates(taken: string): string[] {
  const base = normalizeSlugInput(taken).replace(/^-+|-+$/g, "");
  if (!base) return [];
  const candidates = SUGGESTION_PATTERNS.map((pattern) => {
    const room = SLUG_MAX_LENGTH - (pattern("").length);
    return pattern(base.slice(0, room).replace(/-+$/, ""));
  });
  return [...new Set(candidates)].filter((candidate) => candidate !== base && slugSchema.safeParse(candidate).success);
}
