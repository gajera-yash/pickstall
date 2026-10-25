// Product-wide constants. Change the product name or domain here only.

export const APP_NAME = "Pickstall";

/** Root domain for tenant subdomains (`{slug}.ROOT_DOMAIN`, `app.ROOT_DOMAIN`). */
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

/** Store currencies supported in Phase 1 (lowercase, as stored in the database). */
export const CURRENCIES = ["usd", "gbp", "cad"] as const;
export type Currency = (typeof CURRENCIES)[number];

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
