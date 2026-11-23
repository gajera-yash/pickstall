import { z } from "zod";

import { DEFAULT_EMAIL_ACCENT, paragraphsHtml, renderLook, type EmailDesign } from "@/lib/email/looks";
import { escapeHtml, type RenderedEmail } from "@/lib/email/templates";
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

type RenderInput = { storeName: string; productTitle: string; buyerName: string; subject: string; body: string; reviewUrl: string; design?: EmailDesign | null };

/**
 * The email. The creator's text (or the default) comes first; the review button, the store name and
 * the "only one" line are always added and cannot be edited away.
 */
export function renderReviewRequest({ storeName, productTitle, buyerName, subject, body, reviewUrl, design }: RenderInput): RenderedEmail {
  const firstName = buyerName.trim().split(/\s+/)[0] || "there";
  const fill = (value: string) => value.replace(VARIABLE, (_match, name: string) => (name === "customer_name" ? firstName : productTitle));
  const filledSubject = fill(subject.trim() || DEFAULT_REVIEW_SUBJECT).replace(/[\r\n]+/g, " ").trim().slice(0, REVIEW_EMAIL_LIMITS.subject);
  const filledBody = fill(body.trim() || DEFAULT_REVIEW_BODY);
  const footer = `You bought this from ${storeName}. This is the only review request you'll get for this order.`;

  const text = `${filledBody}\n\nLeave a review: ${reviewUrl}\n\n--\n${footer}`;
  const look = design ?? { look: "simple" as const, accent: DEFAULT_EMAIL_ACCENT };
  const html = renderLook({ look: look.look, accent: look.accent, storeName, contentHtml: paragraphsHtml(filledBody, look.accent), button: { label: "Leave a review", url: reviewUrl }, footerHtml: escapeHtml(footer) });
  return { subject: filledSubject, text, html };
}
