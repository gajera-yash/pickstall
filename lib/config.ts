// Product-wide constants. Change the product name or domain here only.

export const APP_NAME = "Pickstall";

/** Where creators reach a person for help. Founder: confirm this mailbox exists before launch. */
export const SUPPORT_EMAIL = "support@pickstall.store";

/** Shown under the logo on auth pages. */
export const APP_TAGLINE = "Creator Store Platform";

/** The one domain the app runs on. Store links are path-based: `{ROOT_DOMAIN}/@username` (D-010). */
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

/** Public link of a store, for display (D-010). */
export function storeLink(username: string): string {
  return `${ROOT_DOMAIN}/@${username}`;
}

/** Email sign-in code: length, and how long the "Resend code" button waits (docs/DECISIONS.md D-002). */
export const OTP_LENGTH = 6;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;
/** How long an emailed sign-in code stays valid. */
export const OTP_TTL_SECONDS = 600;

/**
 * How long Better Auth trusts the signed session cookie before checking the database again
 * (lib/auth/auth.ts). Shorter = a session ended elsewhere stops sooner; longer = fewer DB trips.
 */
export const SESSION_COOKIE_CACHE_SECONDS = 5 * 60;

/** Sign-in code emails per email address and per IP address, in a 15-minute window. */
export const SEND_CODE_RATE_LIMITS = {
  perEmail: { max: 5, windowMinutes: 15 },
  perIp: { max: 20, windowMinutes: 15 },
} as const;

/** Signup details wait server-side this long for the email code (docs/DECISIONS.md D-019). */
export const SIGNUP_INTENT_TTL_MINUTES = 30;

/** Live username checks while typing, per IP address. */
export const USERNAME_CHECK_RATE_LIMIT = { max: 120, windowMinutes: 5 } as const;

/** Signup rate limits (D-019): attempts per email, and new signups per IP address. */
export const SIGNUP_RATE_LIMITS = {
  perEmail: { max: 5, windowMinutes: 15 },
  perIp: { max: 10, windowMinutes: 60 },
} as const;

/** Store currencies supported in Phase 1 (lowercase, as stored in the database). */
export const CURRENCIES = ["usd", "gbp", "cad"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Currency of a new draft store; the creator can change it in Store setup. */
export const DEFAULT_CURRENCY: Currency = "usd";

/** Shown in the currency picker. */
export const CURRENCY_LABELS: Record<Currency, string> = {
  usd: "USD, US dollar",
  gbp: "GBP, British pound",
  cad: "CAD, Canadian dollar",
};

/**
 * Slugs a creator may not claim, because they clash with app subdomains or routes.
 * Compared lowercase.
 */
export const RESERVED_SLUGS: readonly string[] = [
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "blog",
  "checkout",
  "dashboard",
  "help",
  "library",
  "login",
  "mail",
  "onboarding",
  "pricing",
  "privacy",
  "s",
  "signup",
  "static",
  "status",
  "support",
  "terms",
  "www",
];

/** Username changes per owner (D-028). The old link stops working at once (Phase 1). */
export const USERNAME_CHANGE_RATE_LIMIT = { max: 3, windowMinutes: 24 * 60 } as const;

/** Social links on the store page (D-028): https only, shown as icons. */
export const SOCIAL_LINK_KINDS = ["website", "instagram", "youtube", "tiktok", "x", "linkedin", "facebook"] as const;
export type SocialLinkKind = (typeof SOCIAL_LINK_KINDS)[number];
export const SOCIAL_LINK_LABELS: Record<SocialLinkKind, string> = {
  website: "Website",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
  linkedin: "LinkedIn",
  facebook: "Facebook",
};
export const SOCIAL_LINKS_MAX = 6;

/** Product limits (D-030). */
export const PRODUCTS_MAX_PER_STORE = 100;
export const CHECKOUT_QUESTIONS_MAX = 5;
/** Highest price a buyer may enter or a creator may set, in cents. */
export const PRICE_MAX_CENTS = 50_000;
/** Smallest paid price in cents (Stripe's minimum charge is 50 cents; we keep a round 1.00). */
export const PRICE_MIN_PAID_CENTS = 100;
/** Checkout (D-033): attempts per IP address, and the longest answer a buyer may give. */
export const CHECKOUT_RATE_LIMIT = { max: 20, windowMinutes: 10 } as const;
export const ANSWER_MAX_CHARS = { text: 300, long_text: 2000 } as const;
export const BUYER_NAME_MAX = 80;

/** Order email link (D-037): how long the "create your password" link works, and how long we keep its record. */
export const ACCESS_LINK_DAYS = 30;
export const ACCESS_RECORD_DAYS = 90;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_RATE_LIMIT = { max: 10, windowMinutes: 15 } as const;

/** Image uploads per creator (D-032). */
export const UPLOAD_RATE_LIMIT = { max: 30, windowMinutes: 10 } as const;
export const PRODUCT_RATE_LIMIT = { max: 60, windowMinutes: 10 } as const;

export const PLANS = ["trial", "starter", "pro", "business"] as const;
export type Plan = (typeof PLANS)[number];

type PlanLimits = {
  /** `null` means unlimited. */
  maxCourses: number | null;
  videoHours: number;
  emailSubscribers: number;
};

/**
 * Placeholder limits from PRD F9. Not enforced in Phase 1 (billing is Phase 3).
 * Video hours and subscriber counts must be checked against Mux and Resend costs.
 * Trial limits are not decided in the PRD; they mirror Starter for now.
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  trial: { maxCourses: 5, videoHours: 20, emailSubscribers: 1_000 },
  starter: { maxCourses: 5, videoHours: 20, emailSubscribers: 1_000 },
  pro: { maxCourses: null, videoHours: 100, emailSubscribers: 10_000 },
  business: { maxCourses: null, videoHours: 300, emailSubscribers: 50_000 },
};
