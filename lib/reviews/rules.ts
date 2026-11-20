import { z } from "zod";

import { cleanText } from "@/lib/products/text";

// Product review rules (D-106). Pure and client-safe.

export const REVIEW_TEXT_MAX = 1000;

/** What a buyer sends: 1-5 stars and an optional short text, cleaned of tags and links. */
export const reviewInput = z.object({
  rating: z.number().int().min(1, { error: "Pick 1 to 5 stars." }).max(5, { error: "Pick 1 to 5 stars." }),
  text: z
    .string()
    .max(REVIEW_TEXT_MAX * 2)
    .transform((value) => cleanText(value, { multiline: true }).replace(/https?:\/\/\S+/gi, "").replace(/\n{3,}/g, "\n\n").trim())
    .pipe(z.string().max(REVIEW_TEXT_MAX, { error: `Use ${REVIEW_TEXT_MAX} characters or fewer.` }))
    .transform((value) => (value === "" ? null : value)),
});

/** "Asha Patel" -> "Asha P."; an empty name -> "A buyer". Never the email. */
export function shortName(fullName: string): string {
  const parts = cleanText(fullName).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A buyer";
  const first = parts[0]!.slice(0, 30);
  const last = parts.length > 1 ? `${parts.at(-1)!.charAt(0).toUpperCase()}.` : "";
  return last ? `${first} ${last}` : first;
}

export type RatingSummary = { average: number; count: number };

/** One decimal, like 4.7. */
export function roundRating(average: number): number {
  return Math.round(average * 10) / 10;
}
