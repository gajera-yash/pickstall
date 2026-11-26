// Google Analytics on Pickstall's own pages (D-133). Pure and client-safe. It runs only on the
// marketing and legal pages below, only after the visitor accepts, and never on dashboards, the
// admin, buyers' libraries, checkouts or creators' stores (creators have their own pixels, D-097).

/** Exact paths where Pickstall measures visits (its home, content, sign-up, sign-in and legal pages). */
export const TRACKED_PATHS = ["/", "/pricing", "/features", "/faq", "/about", "/signup", "/login", "/terms", "/privacy", "/refunds", "/cookies", "/acceptable-use", "/copyright"] as const;
/** Content page groups (D-134): one level below these, for example /compare/stan-store. */
const TRACKED_PREFIXES = ["/compare/", "/for/"] as const;

export function isTrackedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.replace(/\/+$/, "") || "/";
  if ((TRACKED_PATHS as readonly string[]).includes(path)) return true;
  return TRACKED_PREFIXES.some((prefix) => path.startsWith(prefix) && /^[a-z0-9-]+$/.test(path.slice(prefix.length)));
}

/** A GA4 measurement id, or null for anything else. */
export function measurementIdOf(value: string | undefined | null): string | null {
  return typeof value === "string" && /^G-[A-Z0-9]{6,12}$/.test(value) ? value : null;
}

export type AnalyticsChoice = "granted" | "denied" | null;
export const CONSENT_KEY = "ps_analytics_consent";
