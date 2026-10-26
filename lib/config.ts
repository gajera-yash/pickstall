// Product-wide constants. Change the product name or domain here only.

export const APP_NAME = "Pickstall";

/** The one domain the app runs on. Store links are path-based: `{ROOT_DOMAIN}/@username` (D-010). */
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

/** Public link of a store, for display (D-010). */
export function storeLink(username: string): string {
  return `${ROOT_DOMAIN}/@${username}`;
}

/** Email sign-in code: length, and how long the "Resend code" button waits (docs/DECISIONS.md D-002). */
export const OTP_LENGTH = 6;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;

/** Signup details wait server-side this long for the email code (docs/DECISIONS.md D-019). */
export const SIGNUP_INTENT_TTL_MINUTES = 30;

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
  "dashboard",
  "help",
  "library",
  "login",
  "mail",
  "onboarding",
  "pricing",
  "privacy",
  "s",
  "static",
  "status",
  "support",
  "terms",
  "www",
];

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
