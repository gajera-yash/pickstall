// Security headers for every response (PRD 5.5, R9). Pure so it can be unit-tested and imported by
// next.config.ts. No "server-only": next.config runs outside the app bundle.

export type HeaderPair = { key: string; value: string };

/**
 * Content Security Policy.
 * - Scripts: Next.js puts its page data in inline scripts. A per-request nonce would make every page
 *   dynamic and switch off the cached public store pages, so inline scripts are allowed; there is no
 *   third-party script host, and creator or buyer text is never rendered as HTML (D-014).
 * - Images: creators may use their own https image links (store avatar, product cover), so any https host.
 * - Forms: `https:` because the "Open your purchase" form and checkout redirect to the creator's https
 *   link or to Stripe Checkout, and browsers apply form-action to the redirect too.
 * - Development also needs eval (React debugging) and the hot-reload websocket.
 */
export function contentSecurityPolicy(isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(isDev ? ["ws:", "wss:"] : [])],
    "media-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https:"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** Headers for every route. Uploaded images (`/media/...`) send their own stricter CSP. */
export function securityHeaders(isDev: boolean): HeaderPair[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    // Browsers ignore HSTS on plain http, and localhost is never https, so it is sent in production only.
    ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
  ];
}

/** The page CSP applies to everything except uploaded images. */
export const PAGE_CSP_SOURCE = "/((?!media/).*)";
