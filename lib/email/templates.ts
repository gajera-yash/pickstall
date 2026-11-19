// Order confirmation email (PRD F7, D-014). Pure, so it is easy to test. Creators may write their own
// subject and message; only the three allowed variables are filled in, everything else stays plain
// text, and the store name (sender identity) and the access link are ALWAYS included.

export type OrderEmailVars = { customerName: string; productTitle: string; accessLink: string };

/**
 * A coaching call's booking (D-084), always added to the email whatever the creator wrote:
 * "confirmed" with the time and the meeting link (or a note that the coach sends it), or
 * "conflict" when a late payment found its time taken.
 */
export type CallDetails = { status: "confirmed" | "conflict"; when: string; meetingUrl: string | null };

export type OrderEmailInput = {
  storeName: string;
  vars: OrderEmailVars;
  /** The creator's own subject and message, or null for the defaults. */
  subject: string | null;
  body: string | null;
  call?: CallDetails | null;
};

/** The booking lines of the email, plain text. */
export function callText(call: CallDetails, storeName: string): string {
  if (call.status === "conflict") return `Your payment is confirmed, but the time you picked (${call.when}) was just taken. ${storeName} will contact you to choose a new time.`;
  const join = call.meetingUrl ? `Join the call here:\n${call.meetingUrl}` : `${storeName} will email you the meeting link before the call.`;
  return `Your call: ${call.when}\n${join}\n\nA calendar file is attached, so you can add the call to your calendar.`;
}

/** Makes the (already escaped) https links in a text clickable. */
export function linkify(escaped: string): string {
  return escaped.replace(/https:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#0056ff">${url}</a>`);
}

export type RenderedEmail = { subject: string; text: string; html: string };

/** Inline colors for list emails (D-095): email HTML cannot use the CSS tokens. */
export const LIST_EMAIL_COLORS = { text: "#111827", muted: "#6b7280", border: "#e5e7eb" } as const;

const VARIABLE = /\{\{\s*(customer_name|product_title|download_link)\s*\}\}/g;

/** Fills the three allowed variables. Any other `{{...}}` is left as it is (the creator form rejects them). */
export function fillVariables(template: string, vars: OrderEmailVars): string {
  return template.replace(VARIABLE, (_match, name: string) => {
    if (name === "customer_name") return vars.customerName;
    if (name === "product_title") return vars.productTitle;
    return vars.accessLink;
  });
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** A header-safe subject: no line breaks, at most 150 characters. */
function cleanSubject(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 150);
}

export function renderOrderEmail(input: OrderEmailInput): RenderedEmail {
  const { vars, storeName } = input;
  // A booked call (D-084) says so in the default subject.
  const fallback = input.call?.status === "confirmed" ? `Your call is booked: ${vars.productTitle}` : `Your order: ${vars.productTitle}`;
  const subject = cleanSubject(input.subject ? fillVariables(input.subject, vars) : fallback) || fallback;

  const intro = input.body
    ? fillVariables(input.body, vars)
    : `Hi ${vars.customerName},\n\nThanks for your purchase of ${vars.productTitle}. Your order is confirmed.`;

  // The link is always present, even if the creator's own message forgot the variable.
  const alreadyHasLink = intro.includes(vars.accessLink);
  const action = `Create your password and open your purchase:\n${vars.accessLink}`;
  const footer = `Sent for ${storeName} through Pickstall. If you didn't buy this, you can ignore this email.`;

  const call = input.call ? callText(input.call, storeName) : "";
  const text = [intro, call, alreadyHasLink ? "" : action, footer].filter(Boolean).join("\n\n");

  const htmlIntro = escapeHtml(intro).replace(/\n/g, "<br>");
  const callHtml = call ? `<div style="margin:20px 0 0;padding:14px 16px;border:1px solid #e5e7eb;border-radius:12px;line-height:1.55">${linkify(escapeHtml(call)).replace(/\n/g, "<br>")}</div>` : "";
  const button = `<p style="margin:24px 0"><a href="${escapeHtml(vars.accessLink)}" style="background:#0056ff;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Create your password and open your purchase</a></p>`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f9fc;font-family:Arial,Helvetica,sans-serif;color:#0b0d2a"><div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px"><p style="margin:0 0 4px;font-weight:700">${escapeHtml(storeName)}</p><div style="line-height:1.55">${htmlIntro}</div>${callHtml}${button}<p style="color:#555a82;font-size:13px;line-height:1.5">${escapeHtml(footer)}</p></div></body></html>`;

  return { subject, text, html };
}

export type CallReminderInput = {
  storeName: string;
  customerName: string;
  productTitle: string;
  /** "in 24 hours" or "in 1 hour". */
  lead: string;
  /** The call time in the buyer's zone (formatCallTime). */
  when: string;
  meetingUrl: string | null;
  /** The buyer's library page for this booking. */
  libraryUrl: string;
};

/**
 * Reminder before a coaching call (D-085). Fixed text (creators do not write it), with the sender
 * identity, the time, the meeting link (or that the coach sends it) and the library link.
 */
export function renderCallReminder(input: CallReminderInput): RenderedEmail {
  const subject = cleanSubject(`Reminder: your call ${input.lead} (${input.productTitle})`);
  const join = input.meetingUrl ? `Join the call here:\n${input.meetingUrl}` : `${input.storeName} will email you the meeting link.`;
  const footer = `Sent for ${input.storeName} through Pickstall. You get this because you booked this call.`;
  const text = [`Hi ${input.customerName},`, `Your ${input.productTitle} call with ${input.storeName} starts ${input.lead}.`, `When: ${input.when}`, join, `Your booking:\n${input.libraryUrl}`, footer].join("\n\n");
  const body = [`Hi ${input.customerName},`, `Your ${input.productTitle} call with ${input.storeName} starts ${input.lead}.`, `When: ${input.when}`, join]
    .map((part) => `<p style="margin:0 0 14px">${linkify(escapeHtml(part)).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = `<p style="margin:20px 0"><a href="${escapeHtml(input.libraryUrl)}" style="background:#0056ff;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">View your booking</a></p>`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f9fc;font-family:Arial,Helvetica,sans-serif;color:#0b0d2a"><div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px"><p style="margin:0 0 12px;font-weight:700">${escapeHtml(input.storeName)}</p><div style="line-height:1.55">${body}</div>${button}<p style="color:#555a82;font-size:13px;line-height:1.5">${escapeHtml(footer)}</p></div></body></html>`;
  return { subject, text, html };
}

export type CallCancelledInput = { storeName: string; customerName: string; productTitle: string; when: string; refunded: boolean };

/** Tells the buyer their coaching call was cancelled by the coach (D-086). Fixed text, with the sender identity. */
export function renderCallCancelled(input: CallCancelledInput): RenderedEmail {
  const subject = cleanSubject(`Your call was cancelled: ${input.productTitle}`);
  const money = input.refunded ? "You get a full refund to the card you paid with, usually within 5 to 10 days." : "";
  const footer = `Sent for ${input.storeName} through Pickstall.`;
  const parts = [`Hi ${input.customerName},`, `${input.storeName} cancelled your ${input.productTitle} call on ${input.when}.`, money, `If you have questions, contact ${input.storeName}.`].filter(Boolean);
  const text = [...parts, footer].join("\n\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f9fc;font-family:Arial,Helvetica,sans-serif;color:#0b0d2a"><div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px"><p style="margin:0 0 12px;font-weight:700">${escapeHtml(input.storeName)}</p><div style="line-height:1.55">${parts.map((part) => `<p style="margin:0 0 14px">${escapeHtml(part)}</p>`).join("")}</div><p style="color:#555a82;font-size:13px;line-height:1.5">${escapeHtml(footer)}</p></div></body></html>`;
  return { subject, text, html };
}
