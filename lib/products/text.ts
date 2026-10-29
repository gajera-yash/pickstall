import { hasControlChar } from "@/lib/text";

/**
 * Cleans creator text (D-014): removes anything that looks like an HTML tag and control characters
 * (line breaks kept when `multiline`), then trims. React escapes the rest when it is shown, and
 * nothing renders raw HTML.
 */
export function cleanText(value: string, options: { multiline?: boolean } = {}): string {
  const noTags = value.replace(/<\/?[a-zA-Z!][^>]*>?/g, "");
  const noControl = [...noTags].filter((ch) => !hasControlChar(ch, { allowNewlines: options.multiline })).join("");
  return noControl.trim();
}

/** The only variables an email template may use (D-014). */
export const EMAIL_VARIABLES = ["customer_name", "product_title", "download_link"] as const;

/** Variables used in a text that are not on the allow-list. */
export function unknownEmailVariables(text: string): string[] {
  const found = [...text.matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)].map((match) => match[1] ?? "");
  return [...new Set(found.filter((name) => !(EMAIL_VARIABLES as readonly string[]).includes(name)))];
}

/** Questions that ask for card, ID or password details are not allowed (D-014). */
const SENSITIVE = /(card\s*(number|no\b)|credit\s*card|debit\s*card|\bcvv\b|\bcvc\b|\bssn\b|social\s*security|passport|aadhaar|aadhar|\bpan\s*(card|number)|driving\s*licen|password|\biban\b|bank\s*account|\bpin\b\s*(code|number))/i;

export function isSensitiveQuestion(label: string): boolean {
  return SENSITIVE.test(label);
}
