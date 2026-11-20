import { z } from "zod";

import { LIST_EMAIL_COLORS as C, escapeHtml, linkify, type RenderedEmail } from "@/lib/email/templates";
import { cleanText } from "@/lib/products/text";

// "Please review" emails (D-117). Pure, so the settings preview, the job and the tests agree.
// One email per paid order, a week after the purchase, asking the buyer to rate the product.

/** How long after the order is paid the email goes out. */
export const REVIEW_REQUEST_DELAY_MS = 7 * 24 * 60 * 60 * 1000;
export const REVIEW_EMAIL_LIMITS = { subject: 150, body: 2000 } as const;

export const DEFAULT_REVIEW_SUBJECT = "How are you finding {{product_title}}?";
export const DEFAULT_REVIEW_BODY = "Hi {{customer_name}},\n\nYou got {{product_title}} a week ago. Would you take a minute to rate it? Your review helps other people decide.";

const VARIABLE = /\{\{\s*(customer_name|product_title)\s*\}\}/g;
const ANY_VARIABLE = /\{\{\s*([^{}]*?)\s*\}\}/g;

function reviewText(max: number, label: string, multiline: boolean) {
  return z
    .string()
    .transform((value) => cleanText(value, { multiline }))
    .pipe(
      z
        .string()
        .max(max, { error: `${label}: use ${max} characters or fewer.` })
        .refine((value) => [...value.matchAll(ANY_VARIABLE)].every((match) => match[1] === "customer_name" || match[1] === "product_title"), {
          error: `${label}: only {{customer_name}} and {{product_title}} can be used.`,
        }),
    );
}

/** The settings form: on/off and optional text (empty means the default). */
export const reviewRequestSettingsInput = z.object({
  enabled: z.boolean(),
  subject: reviewText(REVIEW_EMAIL_LIMITS.subject, "Subject", false),
  body: reviewText(REVIEW_EMAIL_LIMITS.body, "Message", true),
});
export type ReviewRequestSettings = z.infer<typeof reviewRequestSettingsInput>;

type RenderInput = { storeName: string; productTitle: string; buyerName: string; subject: string; body: string; reviewUrl: string };

/**
 * The email. The creator's text (or the default) comes first; the review button, the store name and
 * the "only one" line are always added and cannot be edited away.
 */
export function renderReviewRequest({ storeName, productTitle, buyerName, subject, body, reviewUrl }: RenderInput): RenderedEmail {
  const firstName = buyerName.trim().split(/\s+/)[0] || "there";
  const fill = (value: string) => value.replace(VARIABLE, (_match, name: string) => (name === "customer_name" ? firstName : productTitle));
  const filledSubject = fill(subject.trim() || DEFAULT_REVIEW_SUBJECT).replace(/[\r\n]+/g, " ").trim().slice(0, REVIEW_EMAIL_LIMITS.subject);
  const filledBody = fill(body.trim() || DEFAULT_REVIEW_BODY);
  const footer = `You bought this from ${storeName}. This is the only review request you'll get for this order.`;

  const text = `${filledBody}\n\nLeave a review: ${reviewUrl}\n\n--\n${footer}`;
  const paragraphs = filledBody
    .split(/\n{2,}/)
    .map((part) => `<p style="margin:0 0 16px">${linkify(escapeHtml(part)).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = `<p style="margin:24px 0"><a href="${escapeHtml(reviewUrl)}" style="background:${C.button};color:${C.onButton};padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Leave a review</a></p>`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${C.text};max-width:560px;margin:0 auto;padding:24px">${paragraphs}${button}<hr style="border:none;border-top:1px solid ${C.border};margin:32px 0 16px"><p style="margin:0;font-size:13px;color:${C.muted}">${escapeHtml(footer)}</p></div>`;
  return { subject: filledSubject, text, html };
}
