import { emailSchema } from "@/lib/auth/schemas";
import { SOCIAL_LINK_KINDS, type SocialLinkKind } from "@/lib/config";

// Social links from usernames (D-046). The creator types a username; we build the profile link.
// Rules come from each platform's help center, checked 2026-11-03: X (letters, numbers, _, up to 15),
// YouTube handles (3-30, letters and numbers in any language plus . - _ ·, not at the ends),
// Facebook (letters, numbers, periods, at least 5) and LinkedIn custom URLs (3-100, no spaces or
// symbols). Instagram's and TikTok's pages could not be read, so they get a lenient check. This is
// a format check only: it cannot tell whether the account exists.

export type HandleKind = Exclude<SocialLinkKind, "email" | "website">;

type Rule = {
  /** Shown before the input, like "instagram.com/". */
  prefix: string;
  placeholder: string;
  hint: string;
  valid: (handle: string) => boolean;
  url: (handle: string) => string;
  /** Hosts whose profile links we can read a username back from. */
  hosts: readonly string[];
  /** The username in a profile link's path, or null. */
  fromPath: (path: string) => string | null;
};

const firstSegment = (path: string, prefix = "") => {
  const segment = path.split("/").filter(Boolean)[0] ?? "";
  if (!segment.startsWith(prefix)) return null;
  return decodeURIComponent(segment.slice(prefix.length)) || null;
};

const lenient = (handle: string) => /^[A-Za-z0-9._]{1,50}$/.test(handle);

export const HANDLE_RULES: Record<HandleKind, Rule> = {
  instagram: {
    prefix: "instagram.com/",
    placeholder: "yourname",
    hint: "Letters, numbers, periods and underscores.",
    valid: lenient,
    url: (handle) => `https://www.instagram.com/${handle}`,
    hosts: ["instagram.com", "www.instagram.com"],
    fromPath: (path) => firstSegment(path),
  },
  tiktok: {
    prefix: "tiktok.com/@",
    placeholder: "yourname",
    hint: "Letters, numbers, periods and underscores.",
    valid: lenient,
    url: (handle) => `https://www.tiktok.com/@${handle}`,
    hosts: ["tiktok.com", "www.tiktok.com"],
    fromPath: (path) => firstSegment(path, "@"),
  },
  facebook: {
    prefix: "facebook.com/",
    placeholder: "yourname",
    hint: "At least 5 letters, numbers or periods.",
    // Facebook states no maximum; 50 is our own cap.
    valid: (handle) => /^[A-Za-z0-9.]{5,50}$/.test(handle),
    url: (handle) => `https://www.facebook.com/${handle}`,
    hosts: ["facebook.com", "www.facebook.com", "m.facebook.com"],
    fromPath: (path) => firstSegment(path),
  },
  x: {
    prefix: "x.com/",
    placeholder: "yourname",
    hint: "Up to 15 letters, numbers or underscores.",
    valid: (handle) => /^[A-Za-z0-9_]{1,15}$/.test(handle),
    url: (handle) => `https://x.com/${handle}`,
    hosts: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
    fromPath: (path) => firstSegment(path),
  },
  linkedin: {
    prefix: "linkedin.com/in/",
    placeholder: "your-name",
    hint: "3 to 100 letters, numbers or hyphens.",
    valid: (handle) => /^[\p{L}\p{N}-]{3,100}$/u.test(handle),
    url: (handle) => `https://www.linkedin.com/in/${encodeURIComponent(handle)}`,
    hosts: ["linkedin.com", "www.linkedin.com"],
    fromPath: (path) => (path.split("/").filter(Boolean)[0] === "in" ? decodeURIComponent(path.split("/").filter(Boolean)[1] ?? "") || null : null),
  },
  youtube: {
    prefix: "youtube.com/@",
    placeholder: "yourchannel",
    hint: "3 to 30 letters or numbers; . - _ allowed, but not at the start or end.",
    valid: (handle) => {
      if (!/^[\p{L}\p{N}](?:[\p{L}\p{N}._\-·]*[\p{L}\p{N}])?$/u.test(handle)) return false;
      const length = [...handle].length;
      // Han, Hangul, Japanese and Ethiopic handles may be shorter than 3; keep those lenient.
      const latinOnly = /^[A-Za-z0-9._\-·]+$/.test(handle);
      return length <= 30 && (!latinOnly || length >= 3);
    },
    url: (handle) => `https://www.youtube.com/@${encodeURIComponent(handle)}`,
    hosts: ["youtube.com", "www.youtube.com", "m.youtube.com"],
    fromPath: (path) => firstSegment(path, "@"),
  },
};

export const isHandleKind = (kind: SocialLinkKind): kind is HandleKind => kind !== "email" && kind !== "website";

/**
 * What the creator typed, as a bare username: spaces trimmed, a leading @ dropped, and a pasted
 * profile link on the platform's own host turned into its username.
 */
export function normalizeHandle(kind: HandleKind, raw: string): string {
  const value = raw.trim();
  const fromLink = handleFromUrl(kind, /^https?:\/\//i.test(value) ? value : value.includes("/") ? `https://${value}` : "");
  if (fromLink) return fromLink;
  return value.replace(/^@/, "");
}

/** The username in a saved profile link, or null when the link is not on that platform. */
export function handleFromUrl(kind: HandleKind, url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const rule = HANDLE_RULES[kind];
    return rule.hosts.includes(parsed.hostname.toLowerCase()) ? rule.fromPath(parsed.pathname) : null;
  } catch {
    return null;
  }
}

export type SocialValueCheck = { ok: true; url: string } | { ok: false; error: string };

/**
 * Checks one row of the social links form and builds the link to store: a profile URL for a
 * username, `mailto:` for an email, the https URL itself for a website. Empty means "no link".
 */
export function checkSocialValue(kind: SocialLinkKind, raw: string): SocialValueCheck | null {
  const value = raw.trim();
  if (value === "") return null;
  if (kind === "email") {
    const email = emailSchema.safeParse(value);
    return email.success ? { ok: true, url: `mailto:${email.data}` } : { ok: false, error: "Enter a valid email address." };
  }
  if (kind === "website") {
    try {
      const url = new URL(value);
      const fine = url.protocol === "https:" && url.hostname.includes(".") && !url.username && !url.password;
      // Keep the link exactly as typed (URL.toString() would add a trailing slash).
      return fine ? { ok: true, url: value } : { ok: false, error: "Enter a full link that starts with https://" };
    } catch {
      return { ok: false, error: "Enter a full link that starts with https://" };
    }
  }
  const handle = normalizeHandle(kind, value);
  const rule = HANDLE_RULES[kind];
  return rule.valid(handle) ? { ok: true, url: rule.url(handle) } : { ok: false, error: rule.hint };
}

/** The value to show in a row for a saved link: the username, the email, or the website link. */
export function displayValueFor(kind: SocialLinkKind, url: string): string {
  if (kind === "email") return url.replace(/^mailto:/i, "");
  if (kind === "website") return url;
  return handleFromUrl(kind, url) ?? url;
}

/** The form field for one platform's row. */
export const socialFieldName = (kind: SocialLinkKind) => `social-${kind}`;

/**
 * Reads the social links form: one field per platform (`social-instagram`, ...), in the fixed
 * order. Empty rows are skipped. The first invalid row comes back with its field name, so the
 * form can point at it; nothing is saved then.
 */
export function socialLinksFromForm(formData: FormData): { ok: true; links: { kind: SocialLinkKind; url: string }[] } | { ok: false; field: string; error: string } {
  const links: { kind: SocialLinkKind; url: string }[] = [];
  for (const kind of SOCIAL_LINK_KINDS) {
    const raw = formData.get(socialFieldName(kind));
    const check = checkSocialValue(kind, typeof raw === "string" ? raw : "");
    if (!check) continue;
    if (!check.ok) return { ok: false, field: socialFieldName(kind), error: check.error };
    links.push({ kind, url: check.url });
  }
  return { ok: true, links };
}
