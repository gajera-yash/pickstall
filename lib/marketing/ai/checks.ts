import { z } from "zod";

import type { DraftPair } from "@/lib/marketing/ai/types";

// Honesty and safety checks on every AI draft (D-121, PRD section 2.6). A draft that fails is
// written again once, then replaced by the template; the founder still reads it before sending.

export const DRAFT_MAX = 600;

const BANNED: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.]+/, "contains an email address"],
  [/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|store|io|ai|co|net|org|app|link)\b/i, "contains a link"],
  [/\[[^\]]*\]|\{[^}]*\}|<[^>]*>/, "contains a placeholder or markup"],
  [/\btax(es)?\b|\bvat\b|\bgst\b/i, "mentions tax"],
  [/guarantee|risk[- ]free|100% (free|safe)|testimonial|trusted by|thousands of creators/i, "makes a claim we cannot back"],
  [/apple pay|google pay|credit card checkout|card checkout|stripe/i, "promises a checkout we do not offer"],
];

/** The reason a message breaks a rule, or null when it is fine. */
export function messageProblem(text: string): string | null {
  const value = text.trim();
  if (value.length < 20) return "is too short";
  if (value.length > DRAFT_MAX) return `is over ${DRAFT_MAX} characters`;
  for (const [pattern, reason] of BANNED) if (pattern.test(value)) return reason;
  if (/\b0 ?%/.test(value) && !/paypal/i.test(value)) return "says 0% without PayPal's processing fees";
  return null;
}

/** The reason a draft pair breaks a rule, or null. */
export function draftProblem(pair: DraftPair): string | null {
  const first = messageProblem(pair.firstMessage);
  if (first) return `First message ${first}`;
  const followUp = messageProblem(pair.followUp);
  if (followUp) return `Follow-up ${followUp}`;
  return null;
}

/** The JSON shape a writer must return (also sent to Groq as a strict schema). */
export const draftPairSchema = z.object({ firstMessage: z.string().min(1).max(2_000), followUp: z.string().min(1).max(2_000) });

/** Trims and collapses runs of blank lines; keeps single line breaks. */
export function tidyMessage(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
