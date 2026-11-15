// Email rules for new stores (Phase A, D-071). Pure and client-safe, so the signup form, the
// server and the tests share them.

import { DISPOSABLE_EMAIL_DOMAINS } from "@/lib/auth/disposable-domains";

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * One key per real inbox, used to allow one store (and one free trial) per person:
 * lower case, `+tag` removed (most providers deliver `name+tag@` to `name@`), and for Gmail the
 * dots removed and googlemail.com folded into gmail.com (Gmail ignores dots).
 * Returns null for something that is not an email.
 */
export function canonicalEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return null;
  let local = value.slice(0, at);
  let domain = value.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (GMAIL_DOMAINS.has(domain)) {
    domain = "gmail.com";
    local = local.replace(/\./g, "");
  }
  if (!local) return null;
  return `${local}@${domain}`;
}

/** Is this a throwaway inbox (the domain or any parent domain is on the list)? */
export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (DISPOSABLE_EMAIL_DOMAINS.has(parts.slice(i).join("."))) return true;
  }
  return false;
}

export const DISPOSABLE_EMAIL_MESSAGE = "Use a permanent email address. Temporary inboxes can't open a store.";
