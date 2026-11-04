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

/**
 * Store currencies (D-046): Stripe's presentment currencies for card payments, as listed on
 * docs.stripe.com/currencies for US, UK and Canadian accounts, checked 2026-11-03. Lowercase, as
 * stored in the database and sent to Stripe. Stripe decides at checkout whether a creator's own
 * account can take a currency; re-check this list before changing it.
 */
export const CURRENCIES = [
  "aed", "afn", "all", "amd", "ang", "aoa", "ars", "aud", "awg", "azn", "bam", "bbd",
  "bdt", "bif", "bmd", "bnd", "bob", "brl", "bsd", "bwp", "byn", "bzd", "cad", "cdf",
  "chf", "clp", "cny", "cop", "crc", "cve", "czk", "djf", "dkk", "dop", "dzd", "egp",
  "etb", "eur", "fjd", "fkp", "gbp", "gel", "gip", "gmd", "gnf", "gtq", "gyd", "hkd",
  "hnl", "htg", "huf", "idr", "ils", "inr", "isk", "jmd", "jpy", "kes", "kgs", "khr",
  "kmf", "krw", "kyd", "kzt", "lak", "lbp", "lkr", "lrd", "lsl", "mad", "mdl", "mga",
  "mkd", "mmk", "mnt", "mop", "mur", "mvr", "mwk", "mxn", "myr", "mzn", "nad", "ngn",
  "nio", "nok", "npr", "nzd", "pab", "pen", "pgk", "php", "pkr", "pln", "pyg", "qar",
  "ron", "rsd", "rub", "rwf", "sar", "sbd", "scr", "sek", "sgd", "shp", "sle", "sos",
  "srd", "std", "szl", "thb", "tjs", "top", "try", "ttd", "twd", "tzs", "uah", "ugx",
  "usd", "uyu", "uzs", "vnd", "vuv", "wst", "xaf", "xcd", "xcg", "xof", "xpf", "yer",
  "zar", "zmw",
] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Currency of a new draft store; the creator can change it in Store setup until the first product. */
export const DEFAULT_CURRENCY: Currency = "usd";

/**
 * Zero-decimal currencies (docs.stripe.com/currencies, "Zero-decimal currencies"): the amount sent to
 * Stripe is the whole amount (500 JPY is 500). UGX is on Stripe's list but is a special case (below).
 */
export const ZERO_DECIMAL_CURRENCIES: readonly Currency[] = ["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "vnd", "vuv", "xaf", "xof", "xpf"];

/**
 * Stripe's "special cases" that are charged in whole units but still sent as two-decimal amounts
 * ending in 00 (5 ISK is 500). Prices in these currencies have no fraction.
 */
export const WHOLE_UNIT_CURRENCIES: readonly Currency[] = ["isk", "ugx"];

/**
 * Stripe's minimum charge per currency (docs.stripe.com/currencies, "Minimum charge amount by
 * currency"), in the amount units Stripe expects. Currencies not listed use one whole unit; Stripe
 * still checks its own minimum when the checkout is created.
 */
export const STRIPE_MIN_CHARGE: Partial<Record<Currency, number>> = {
  usd: 50, aed: 200, ars: 50, aud: 50, brl: 50, cad: 50, chf: 50, cop: 50, czk: 1500, dkk: 250, eur: 50,
  gbp: 30, hkd: 400, huf: 17500, idr: 50, ils: 50, inr: 50, jpy: 50, krw: 50, mxn: 1000, myr: 200,
  nok: 300, nzd: 50, php: 50, pln: 200, ron: 200, rub: 50, sek: 300, sgd: 50, thb: 1000, zar: 50,
};

/** Highest amount, in Stripe amount units: Stripe's 8-digit limit for most currencies and payment methods. */
export const PRICE_MAX_UNITS = 99_999_999;

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

/**
 * Social links on the store page (D-028, D-046): one fixed row per platform, in this order, filled in
 * with a username (an email address for Email, an https link for Website), shown as logos.
 */
export const SOCIAL_LINK_KINDS = ["instagram", "tiktok", "facebook", "x", "linkedin", "youtube", "email", "website"] as const;
export type SocialLinkKind = (typeof SOCIAL_LINK_KINDS)[number];
export const SOCIAL_LINK_LABELS: Record<SocialLinkKind, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  email: "Email",
  website: "Website",
};
/** One link per platform. */
export const SOCIAL_LINKS_MAX = SOCIAL_LINK_KINDS.length;

/** Product limits (D-030). */
export const PRODUCTS_MAX_PER_STORE = 100;
export const CHECKOUT_QUESTIONS_MAX = 5;
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

/** Product files buyers download (D-050): largest size, and uploads per creator. */
export const PRODUCT_FILE_MAX_BYTES = 200 * 1024 * 1024;
export const PRODUCT_FILE_UPLOAD_RATE_LIMIT = { max: 20, windowMinutes: 10 } as const;
export const PRODUCT_RATE_LIMIT = { max: 60, windowMinutes: 10 } as const;
/** Curriculum edits (D-055): many small saves while building a course. */
export const COURSE_EDIT_RATE_LIMIT = { max: 300, windowMinutes: 10 } as const;
/** Starting a Bunny video upload creates a video in the creator's library. */
export const COURSE_VIDEO_UPLOAD_RATE_LIMIT = { max: 30, windowMinutes: 60 } as const;

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

/**
 * Planned monthly prices from PRD F9, integer cents. Shown on the landing page as "planned"; billing is
 * Phase 3 and founding creators pay nothing for 6 months. Change them here only.
 */
export const PLANNED_PRICE_CENTS: Record<Exclude<Plan, "trial">, number> = {
  starter: 1900,
  pro: 3900,
  business: 7900,
};
