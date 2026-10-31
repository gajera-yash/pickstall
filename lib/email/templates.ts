// Order confirmation email (PRD F7, D-014). Pure, so it is easy to test. Creators may write their own
// subject and message; only the three allowed variables are filled in, everything else stays plain
// text, and the store name (sender identity) and the access link are ALWAYS included.

export type OrderEmailVars = { customerName: string; productTitle: string; accessLink: string };

export type OrderEmailInput = {
  storeName: string;
  vars: OrderEmailVars;
  /** The creator's own subject and message, or null for the defaults. */
  subject: string | null;
  body: string | null;
};

export type RenderedEmail = { subject: string; text: string; html: string };

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
  const subject = cleanSubject(input.subject ? fillVariables(input.subject, vars) : `Your order: ${vars.productTitle}`) || `Your order: ${vars.productTitle}`;

  const intro = input.body
    ? fillVariables(input.body, vars)
    : `Hi ${vars.customerName},\n\nThanks for your purchase of ${vars.productTitle}. Your order is confirmed.`;

  // The link is always present, even if the creator's own message forgot the variable.
  const alreadyHasLink = intro.includes(vars.accessLink);
  const action = `Create your password and open your purchase:\n${vars.accessLink}`;
  const footer = `Sent for ${storeName} through Pickstall. If you didn't buy this, you can ignore this email.`;

  const text = [intro, alreadyHasLink ? "" : action, footer].filter(Boolean).join("\n\n");

  const htmlIntro = escapeHtml(intro).replace(/\n/g, "<br>");
  const button = `<p style="margin:24px 0"><a href="${escapeHtml(vars.accessLink)}" style="background:#0056ff;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Create your password and open your purchase</a></p>`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f9fc;font-family:Arial,Helvetica,sans-serif;color:#0b0d2a"><div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px"><p style="margin:0 0 4px;font-weight:700">${escapeHtml(storeName)}</p><div style="line-height:1.55">${htmlIntro}</div>${button}<p style="color:#555a82;font-size:13px;line-height:1.5">${escapeHtml(footer)}</p></div></body></html>`;

  return { subject, text, html };
}
