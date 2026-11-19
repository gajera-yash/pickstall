import { z } from "zod";

import { APP_NAME } from "@/lib/config";
import { LIST_EMAIL_COLORS as C, escapeHtml, linkify, type RenderedEmail } from "@/lib/email/templates";
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

type RenderInput = { storeName: string; subject: string; body: string; name: string | null; unsubscribeUrl: string };

/**
 * The email for one subscriber. `{{customer_name}}` becomes their name (or "there"). The footer
 * with the store name, why they get it and the unsubscribe link is always added and cannot be
 * edited by the creator (CLAUDE.md 5).
 */
export function renderListEmail({ storeName, subject, body, name, unsubscribeUrl }: RenderInput): RenderedEmail {
  const fill = (value: string) => value.replace(NAME_VARIABLE, name?.trim() || "there");
  const filledSubject = fill(subject).replace(/[\r\n]+/g, " ").trim().slice(0, LIST_EMAIL_LIMITS.subject);
  const filledBody = fill(body);
  const why = `You get this email because you joined the email list of ${storeName}.`;

  const text = `${filledBody}\n\n--\n${why}\nUnsubscribe: ${unsubscribeUrl}`;
  const paragraphs = filledBody
    .split(/\n{2,}/)
    .map((part) => `<p style="margin:0 0 16px">${linkify(escapeHtml(part)).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${C.text};max-width:560px;margin:0 auto;padding:24px">${paragraphs}<hr style="border:none;border-top:1px solid ${C.border};margin:32px 0 16px"><p style="margin:0;font-size:13px;color:${C.muted}">${escapeHtml(why)} <a href="${escapeHtml(unsubscribeUrl)}" style="color:${C.muted}">Unsubscribe</a></p></div>`;
  return { subject: filledSubject, text, html };
}

/** Whether a store may start another broadcast, given how many it started in the last 24 hours. */
export function broadcastProblem(input: { startedToday: number; subscribed: number; limit: number }): string | null {
  if (input.subscribed === 0) return "Nobody is subscribed yet.";
  if (input.subscribed > input.limit) return `Your list has ${input.subscribed.toLocaleString("en")} subscribers and your plan allows ${input.limit.toLocaleString("en")}. Upgrade your plan to send.`;
  if (input.startedToday >= BROADCASTS_PER_DAY) return `You can send ${BROADCASTS_PER_DAY} broadcasts a day. Try again tomorrow.`;
  return null;
}
