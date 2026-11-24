import { z } from "zod";

import { APP_NAME } from "@/lib/config";
import { DEFAULT_EMAIL_ACCENT, paragraphsHtml, renderLook, type EmailDesign } from "@/lib/email/looks";
import { escapeHtml, type RenderedEmail } from "@/lib/email/templates";
import { cleanText } from "@/lib/products/text";

// Emails to a creator's list (D-095): broadcasts and the welcome email. Pure, so the editor
// preview, the sender and the tests render exactly the same thing.

export const LIST_EMAIL_LIMITS = { subject: 150, body: 10_000 } as const;
/** Broadcasts one store may start per rolling 24 hours (spam protection for the shared domain). */
export const BROADCASTS_PER_DAY = 3;
/** Emails per Resend batch call (Resend's maximum is 100). */
export const BROADCAST_BATCH_SIZE = 100;

const NAME_VARIABLE = /\{\{\s*customer_name\s*\}\}/g;
const ANY_VARIABLE = /\{\{\s*([^{}]*?)\s*\}\}/g;

function listText(max: number, label: string, multiline: boolean) {
  return z
    .string()
    .transform((value) => cleanText(value, { multiline }))
    .pipe(
      z
        .string()
        .min(1, { error: `Write the ${label.toLowerCase()}.` })
        .max(max, { error: `${label}: use ${max} characters or fewer.` })
        .refine((value) => [...value.matchAll(ANY_VARIABLE)].every((match) => match[1] === "customer_name"), { error: `${label}: only {{customer_name}} can be used.` }),
    );
}

/** A broadcast or welcome email as the creator writes it: plain text, cleaned of tags. */
export const listEmailInput = z.object({
  subject: listText(LIST_EMAIL_LIMITS.subject, "Subject", false),
  body: listText(LIST_EMAIL_LIMITS.body, "Message", true),
});
export type ListEmailInput = z.infer<typeof listEmailInput>;

/** The sender name: the store, "via" the platform. Header-safe: no quotes, brackets or breaks. */
export function senderName(storeName: string): string {
  const clean = storeName.replace(/[\r\n]+/g, " ").replace(/["<>\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
  return `${clean || "A creator"} via ${APP_NAME}`;
}

/** RFC 8058 one-click unsubscribe headers (Gmail and Yahoo require them for bulk mail). */
export function unsubscribeHeaders(oneClickUrl: string): Record<string, string> {
  return { "List-Unsubscribe": `<${oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

/** `design` is the store's email design (D-124); missing: the simple look. */
type RenderInput = { storeName: string; subject: string; body: string; name: string | null; unsubscribeUrl: string; design?: EmailDesign | null };

/**
 * The email for one subscriber. `{{customer_name}}` becomes their name (or "there"). The footer
 * with the store name, why they get it and the unsubscribe link is always added and cannot be
 * edited by the creator (CLAUDE.md 5).
 */
export function renderListEmail({ storeName, subject, body, name, unsubscribeUrl, design }: RenderInput): RenderedEmail {
  const fill = (value: string) => value.replace(NAME_VARIABLE, name?.trim() || "there");
  const filledSubject = fill(subject).replace(/[\r\n]+/g, " ").trim().slice(0, LIST_EMAIL_LIMITS.subject);
  const filledBody = fill(body);
  const why = `You get this email because you joined the email list of ${storeName}.`;

  const text = `${filledBody}\n\n--\n${why}\nUnsubscribe: ${unsubscribeUrl}`;
  const look = design ?? { look: "simple" as const, accent: DEFAULT_EMAIL_ACCENT };
  const html = renderLook({
    look: look.look,
    accent: look.accent,
    storeName,
    contentHtml: paragraphsHtml(filledBody, look.accent),
    footerHtml: `${escapeHtml(why)} <a href="${escapeHtml(unsubscribeUrl)}" style="color:inherit">Unsubscribe</a>`,
  });
  return { subject: filledSubject, text, html };
}

/** Whether a store may start another broadcast, given how many it started in the last 24 hours. */
export function broadcastProblem(input: { startedToday: number; subscribed: number; limit: number; blocked?: boolean }): string | null {
  // A platform admin turned this store's broadcasts off (D-105), for example after spam complaints.
  if (input.blocked) return "Broadcasts are turned off for your store by the Pickstall team. Contact support to sort it out.";
  if (input.subscribed === 0) return "Nobody is subscribed yet.";
  if (input.subscribed > input.limit) return `Your list has ${input.subscribed.toLocaleString("en")} subscribers and your plan allows ${input.limit.toLocaleString("en")}. Upgrade your plan to send.`;
  if (input.startedToday >= BROADCASTS_PER_DAY) return `You can send ${BROADCASTS_PER_DAY} broadcasts a day. Try again tomorrow.`;
  return null;
}
