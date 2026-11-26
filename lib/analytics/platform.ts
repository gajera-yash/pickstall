// Google Analytics on Pickstall's own pages (D-133). Pure and client-safe. It runs only on the
// marketing and legal pages below, only after the visitor accepts, and never on dashboards, the
// admin, buyers' libraries, checkouts or creators' stores (creators have their own pixels, D-097).

/** Exact paths where Pickstall measures visits (its home, sign-up, sign-in and legal pages). */
export const TRACKED_PATHS = ["/", "/signup", "/login", "/terms", "/privacy", "/refunds", "/cookies", "/acceptable-use", "/copyright"] as const;

export function isTrackedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.replace(/\/+$/, "") || "/";
  return (TRACKED_PATHS as readonly string[]).includes(path);
}

/** A GA4 measurement id, or null for anything else. */
export function measurementIdOf(value: string | undefined | null): string | null {
  return typeof value === "string" && /^G-[A-Z0-9]{6,12}$/.test(value) ? value : null;
}

export type AnalyticsChoice = "granted" | "denied" | null;
export const CONSENT_KEY = "ps_analytics_consent";
