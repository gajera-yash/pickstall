import { z } from "zod";

import { cleanText } from "@/lib/products/text";

// The AI writing helper for creators (D-131). Pure and client-safe: what can be written, the input
// rules, the prompts and the checks on what comes back. The Groq call lives in groq-text.ts.
// Only the creator's own words go to the AI (the product title, their notes, their current text);
// never buyer data.

export const AI_KINDS = ["description", "confirmation", "welcome", "broadcast", "cart", "review"] as const;
export type AiKind = (typeof AI_KINDS)[number];

/** Email variables each kind may use (the same lists as each email's own rules). */
export const AI_VARIABLES: Record<AiKind, readonly string[]> = {
  description: [],
  confirmation: ["customer_name", "product_title", "download_link"],
  welcome: ["customer_name"],
  broadcast: ["customer_name"],
  cart: ["customer_name", "product_title"],
  review: ["customer_name", "product_title"],
};

/** Length limits of each field the result fills. */
export const AI_LIMITS: Record<AiKind, { subject: number; body: number }> = {
  description: { subject: 0, body: 2000 },
  confirmation: { subject: 120, body: 2000 },
  welcome: { subject: 150, body: 10_000 },
  broadcast: { subject: 150, body: 10_000 },
  cart: { subject: 150, body: 2000 },
  review: { subject: 150, body: 2000 },
};

export const AI_TONES = ["friendly", "professional", "short", "excited"] as const;
export type AiTone = (typeof AI_TONES)[number];

const text = (max: number) => z.string().max(max * 2).transform((value) => cleanText(value, { multiline: true }).slice(0, max));

export const aiWriteInput = z.object({
  kind: z.enum(AI_KINDS),
  title: text(120),
  notes: text(500),
  current: text(2000),
  tone: z.enum(AI_TONES),
});
export type AiWriteInput = z.infer<typeof aiWriteInput>;

export type AiWriteResult = { subject: string | null; body: string };

const WHAT: Record<AiKind, string> = {
  description: "a product description for the creator's store page: what the buyer gets, who it is for and why it helps. 3 short paragraphs or a few lines with simple dashes for a list",
  confirmation: "the order confirmation email a buyer gets right after paying",
  welcome: "the welcome email a new subscriber gets once after joining the creator's email list",
  broadcast: "an email to everyone on the creator's list",
  cart: "one friendly reminder to a buyer who started checkout but did not finish; it is the only reminder",
  review: "an email a week after a purchase asking the buyer to rate the product",
};

const TONE: Record<AiTone, string> = {
  friendly: "warm and friendly, like a message from a person",
  professional: "clear and professional",
  short: "very short and to the point",
  excited: "upbeat and excited, without hype or false claims",
};

export function aiSystemPrompt(kind: AiKind): string {
  const vars = AI_VARIABLES[kind];
  return [
    "You write for independent creators who sell digital products, courses and coaching on their own store.",
    `Write ${WHAT[kind]}.`,
    "Rules: plain text only (no HTML, no markdown headings, no asterisks), simple English, short sentences.",
    "Never invent facts, prices, numbers, guarantees, discounts, testimonials or deadlines that the creator did not give.",
    "Never ask the reader for passwords, card numbers or personal documents.",
    vars.length > 0
      ? `You may use only these placeholders, written exactly like this: ${vars.map((name) => `{{${name}}}`).join(", ")}. No other {{...}} placeholders.`
      : "Do not use any {{...}} placeholders.",
    kind === "description" ? 'Return JSON: {"subject": "", "body": "..."} with an empty subject.' : 'Return JSON: {"subject": "...", "body": "..."}.',
  ].join("\n");
}

export function aiUserPrompt(input: AiWriteInput): string {
  return [
    `Product or topic: ${input.title || "(not given)"}`,
    `What the creator wants to say: ${input.notes || "(nothing extra)"}`,
    input.current ? `Their current text, to improve rather than replace its meaning:\n${input.current}` : "There is no current text.",
    `Tone: ${TONE[input.tone]}.`,
  ].join("\n");
}

const ANY_VARIABLE = /\{\{\s*([^{}]*?)\s*\}\}/g;

/** Cleans an AI answer: plain text, length limits, and any placeholder this email can't use removed. */
export function tidyAiResult(kind: AiKind, raw: { subject?: unknown; body?: unknown }): AiWriteResult | null {
  const allowed = AI_VARIABLES[kind];
  const fix = (value: string) => value.replace(ANY_VARIABLE, (match, name: string) => (allowed.includes(name) ? `{{${name}}}` : "")).replace(/\*\*/g, "");
  const body = fix(cleanText(typeof raw.body === "string" ? raw.body : "", { multiline: true })).trim().slice(0, AI_LIMITS[kind].body);
  if (!body) return null;
  if (kind === "description") return { subject: null, body };
  const subject = fix(cleanText(typeof raw.subject === "string" ? raw.subject : "")).replace(/[\r\n]+/g, " ").trim().slice(0, AI_LIMITS[kind].subject);
  return { subject: subject || null, body };
}
