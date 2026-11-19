// Email list rules (D-094). Pure, so the checkout, the server and the tests use the same words.

import { buildCsv } from "@/lib/orders/csv";

/** Longest consent text we save; the store name and product title are already length-limited. */
const CONSENT_MAX = 400;

/** The lower-case form that makes an email unique within a store. */
export function emailKeyOf(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The words shown next to the checkout's "Email me updates" tick. Saved with the subscriber as
 * proof of consent, so they must match what the buyer saw.
 */
export function purchaseConsentText(storeName: string): string {
  return `Email me updates and offers from ${storeName}. I can unsubscribe at any time.`.slice(0, CONSENT_MAX);
}

/**
 * The line under a lead magnet's sign-up form: signing up is the consent (founder decision,
 * D-094), so the form says so plainly.
 */
export function leadMagnetConsentText(storeName: string, productTitle: string): string {
  return `By signing up you get "${productTitle}" and emails from ${storeName}. You can unsubscribe at any time.`.slice(0, CONSENT_MAX);
}

/**
 * The consent a checkout records, or null: a lead magnet always signs up (its form says so); any
 * other product only when the buyer ticked the box.
 */
export function consentForCheckout(storeName: string, product: { type: string; title: string }, ticked: boolean, now: Date = new Date()): { at: Date; text: string } | null {
  if (product.type === "lead_magnet") return { at: now, text: leadMagnetConsentText(storeName, product.title) };
  return ticked ? { at: now, text: purchaseConsentText(storeName) } : null;
}

export type SubscriberRow = { email: string; name: string | null; status: "subscribed" | "unsubscribed"; sourceTitle: string; joinedAt: Date };

/** The CSV export: every text cell is neutralized against spreadsheet formulas (D-014). */
export function subscribersCsv(rows: SubscriberRow[]): string {
  return buildCsv(
    ["Email", "Name", "Status", "Joined from", "Joined at (UTC)"],
    rows.map((row) => [row.email, row.name ?? "", row.status === "subscribed" ? "Subscribed" : "Unsubscribed", row.sourceTitle, row.joinedAt.toISOString().slice(0, 19).replace("T", " ")]),
  );
}
