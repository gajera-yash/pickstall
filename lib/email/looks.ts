import { onAccentFor } from "@/lib/themes";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Email designs (D-124). One look per store, used by every email a creator can write: the order
// confirmation, the welcome email, broadcasts, the abandoned cart reminder and the review request.
// Pure and client-safe, so the Email design card previews exactly what is sent. Email HTML cannot
// use CSS variables, so the colors are inline; the accent is the store's own (already validated).

export const EMAIL_LOOKS = ["simple", "card", "bold", "minimal"] as const;
export type EmailLook = (typeof EMAIL_LOOKS)[number];
export const EMAIL_LOOK_LABELS: Record<EmailLook, { name: string; description: string }> = {
  simple: { name: "Simple", description: "Plain text on white, like a personal note." },
  card: { name: "Card", description: "Your message in a white card on a soft background." },
  bold: { name: "Bold", description: "A strip in your accent color with your store name." },
  minimal: { name: "Minimal", description: "Small, quiet and centered." },
};

const INK = "#0b0d2a";
const MUTED = "#555a82";
const BORDER = "#e5e7eb";
const PAGE = "#f7f9fc";
/** The Pickstall blue: the accent when a store has none (or an invalid one). */
export const DEFAULT_EMAIL_ACCENT = "#0056ff";
const FALLBACK_ACCENT = DEFAULT_EMAIL_ACCENT;

export type LookInput = {
  look: EmailLook;
  /** The store's accent (#RRGGBB); anything else falls back to the Pickstall blue. */
  accent: string;
  storeName: string;
  /** Safe HTML: the creator's escaped paragraphs. */
  contentHtml: string;
  /** Safe HTML boxes always added after the message (a call, a license key). */
  extraHtml?: string;
  /** The button (access link, checkout, review), always added. */
  button?: { label: string; url: string } | null;
  /** Safe HTML: the fixed footer (sender identity, why they get it, unsubscribe). */
  footerHtml: string;
};

const FONT = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";

/** The creator's text as escaped paragraphs, with https links made clickable in the accent color. */
export function paragraphsHtml(text: string, accent: string): string {
  const color = /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : FALLBACK_ACCENT;
  return text
    .split(/\n{2,}/)
    .filter((part) => part.trim() !== "")
    .map((part) => `<p style="margin:0 0 16px">${escapeHtml(part).replace(/https:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:${color}">${url}</a>`).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** A boxed note inside the email (a booked call, a license key). */
export function noteBoxHtml(innerHtml: string): string {
  return `<div style="margin:20px 0 0;padding:14px 16px;border:1px solid ${BORDER};border-radius:12px;line-height:1.55">${innerHtml}</div>`;
}

/** The whole email HTML in the chosen look. */
export function renderLook({ look, accent: rawAccent, storeName, contentHtml, extraHtml = "", button, footerHtml }: LookInput): string {
  const accent = /^#[0-9a-fA-F]{6}$/.test(rawAccent) ? rawAccent : FALLBACK_ACCENT;
  const onAccent = onAccentFor(accent.toUpperCase()).color;
  const name = escapeHtml(storeName);
  const radius = look === "minimal" ? 6 : look === "bold" ? 10 : 8;
  const buttonHtml = button
    ? `<p style="margin:24px 0${look === "minimal" ? ";text-align:center" : ""}"><a href="${escapeHtml(button.url)}" style="background:${accent};color:${onAccent};padding:12px 20px;border-radius:${radius}px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(button.label)}</a></p>`
    : "";
  const footer = `<p style="margin:0;color:${MUTED};font-size:13px;line-height:1.5">${footerHtml}</p>`;
  const body = `${contentHtml}${extraHtml}${buttonHtml}`;
  const shell = (bg: string, inner: string) => `<!doctype html><html><body style="margin:0;padding:24px;background:${bg};font-family:${FONT};color:${INK}">${inner}</body></html>`;

  switch (look) {
    case "card":
      return shell(PAGE, `<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px"><p style="margin:0 0 12px;font-weight:700">${name}</p><div style="font-size:16px;line-height:1.6">${body}</div><div style="border-top:1px solid ${BORDER};margin-top:24px;padding-top:16px">${footer}</div></div>`);
    case "bold":
      return shell(PAGE, `<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden"><div style="background:${accent};color:${onAccent};padding:18px 28px;font-size:18px;font-weight:800">${name}</div><div style="padding:28px;font-size:16px;line-height:1.6">${body}<div style="border-top:1px solid ${BORDER};margin-top:24px;padding-top:16px">${footer}</div></div></div>`);
    case "minimal":
      return shell("#ffffff", `<div style="max-width:440px;margin:0 auto;padding:8px 4px;text-align:center"><p style="margin:0 0 20px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${MUTED}">${name}</p><div style="font-size:15px;line-height:1.65;text-align:left">${body}</div><div style="margin-top:28px">${footer}</div></div>`);
    default:
      return shell("#ffffff", `<div style="max-width:560px;margin:0 auto;font-size:16px;line-height:1.6">${body}<hr style="border:none;border-top:1px solid ${BORDER};margin:32px 0 16px">${footer}</div>`);
  }
}

/** The store's email design: its look and accent (D-124). Missing: each email's default look. */
export type EmailDesign = { look: EmailLook; accent: string };

/** The email design of a store document, or null (no look saved: each email keeps its default). */
export function emailDesignOf(store: { emailLook?: unknown; theme?: { accent?: string } } | null | undefined): EmailDesign | null {
  if (!store || typeof store.emailLook !== "string" || !(EMAIL_LOOKS as readonly string[]).includes(store.emailLook)) return null;
  return { look: store.emailLook as EmailLook, accent: store.theme?.accent ?? DEFAULT_EMAIL_ACCENT };
}

/** A saved look, or the default for that email when none is saved (or it is unknown). */
export function lookOf(value: unknown, fallback: EmailLook): EmailLook {
  return typeof value === "string" && (EMAIL_LOOKS as readonly string[]).includes(value) ? (value as EmailLook) : fallback;
}
