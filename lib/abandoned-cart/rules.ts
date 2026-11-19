import { z } from "zod";

import { LIST_EMAIL_COLORS as C, escapeHtml, linkify, type RenderedEmail } from "@/lib/email/templates";
import { cleanText } from "@/lib/products/text";

// Abandoned cart reminders (D-096). Pure, so the settings preview, the job and the tests agree.
// Founder decision: one reminder to everyone who started a paid checkout and did not finish,
// saying plainly that it is the only one.

/** How long after the checkout started the reminder goes out (Stripe sessions expire after 60 min). */
export const REMINDER_DELAY_MS = 2 * 60 * 60 * 1000;
/** At most one reminder per buyer and product in this window. */
export const REMINDER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const CART_EMAIL_LIMITS = { subject: 150, body: 2000 } as const;

export const DEFAULT_CART_SUBJECT = "You left {{product_title}} behind";
export const DEFAULT_CART_BODY = "Hi {{customer_name}},\n\nYou started checking out {{product_title}} but didn't finish. It's still here if you want it.";

const VARIABLE = /\{\{\s*(customer_name|product_title)\s*\}\}/g;
const ANY_VARIABLE = /\{\{\s*([^{}]*?)\s*\}\}/g;

function cartText(max: number, label: string, multiline: boolean) {
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
export const cartSettingsInput = z.object({
  enabled: z.boolean(),
  subject: cartText(CART_EMAIL_LIMITS.subject, "Subject", false),
  body: cartText(CART_EMAIL_LIMITS.body, "Message", true),
});
export type CartSettings = z.infer<typeof cartSettingsInput>;

type RenderInput = { storeName: string; productTitle: string; buyerName: string; subject: string; body: string; checkoutUrl: string };

/**
 * The reminder email. The creator's text (or the default) comes first; the checkout button, the
 * store name and the "only reminder" line are always added and cannot be edited away.
 */
export function renderCartReminder({ storeName, productTitle, buyerName, subject, body, checkoutUrl }: RenderInput): RenderedEmail {
  const firstName = buyerName.trim().split(/\s+/)[0] || "there";
  const fill = (value: string) => value.replace(VARIABLE, (_match, name: string) => (name === "customer_name" ? firstName : productTitle));
  const filledSubject = fill(subject.trim() || DEFAULT_CART_SUBJECT).replace(/[\r\n]+/g, " ").trim().slice(0, CART_EMAIL_LIMITS.subject);
  const filledBody = fill(body.trim() || DEFAULT_CART_BODY);
  const footer = `You started a checkout at ${storeName}. This is the only reminder you'll get for it.`;

  const text = `${filledBody}\n\nFinish your order: ${checkoutUrl}\n\n--\n${footer}`;
  const paragraphs = filledBody
    .split(/\n{2,}/)
    .map((part) => `<p style="margin:0 0 16px">${linkify(escapeHtml(part)).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = `<p style="margin:24px 0"><a href="${escapeHtml(checkoutUrl)}" style="background:${C.button};color:${C.onButton};padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Finish your order</a></p>`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${C.text};max-width:560px;margin:0 auto;padding:24px">${paragraphs}${button}<hr style="border:none;border-top:1px solid ${C.border};margin:32px 0 16px"><p style="margin:0;font-size:13px;color:${C.muted}">${escapeHtml(footer)}</p></div>`;
  return { subject: filledSubject, text, html };
}
