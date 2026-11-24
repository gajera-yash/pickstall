import { z } from "zod";

import { DEFAULT_EMAIL_ACCENT, paragraphsHtml, renderLook, type EmailDesign } from "@/lib/email/looks";
import { escapeHtml, type RenderedEmail } from "@/lib/email/templates";
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

type RenderInput = { storeName: string; productTitle: string; buyerName: string; subject: string; body: string; checkoutUrl: string; design?: EmailDesign | null };

/**
 * The reminder email. The creator's text (or the default) comes first; the checkout button, the
 * store name and the "only reminder" line are always added and cannot be edited away.
 */
export function renderCartReminder({ storeName, productTitle, buyerName, subject, body, checkoutUrl, design }: RenderInput): RenderedEmail {
  const firstName = buyerName.trim().split(/\s+/)[0] || "there";
  const fill = (value: string) => value.replace(VARIABLE, (_match, name: string) => (name === "customer_name" ? firstName : productTitle));
  const filledSubject = fill(subject.trim() || DEFAULT_CART_SUBJECT).replace(/[\r\n]+/g, " ").trim().slice(0, CART_EMAIL_LIMITS.subject);
  const filledBody = fill(body.trim() || DEFAULT_CART_BODY);
  const footer = `You started a checkout at ${storeName}. This is the only reminder you'll get for it.`;

  const text = `${filledBody}\n\nFinish your order: ${checkoutUrl}\n\n--\n${footer}`;
  const look = design ?? { look: "simple" as const, accent: DEFAULT_EMAIL_ACCENT };
  const html = renderLook({ look: look.look, accent: look.accent, storeName, contentHtml: paragraphsHtml(filledBody, look.accent), button: { label: "Finish your order", url: checkoutUrl }, footerHtml: escapeHtml(footer) });
  return { subject: filledSubject, text, html };
}
