const BASE = "http://redirect.invalid";

/**
 * Returns a same-origin path to send the user to after sign-in, or `fallback`.
 * Rejects absolute URLs, protocol-relative (`//evil.test`), backslash tricks and control
 * characters, so a `next` parameter can never cause an open redirect.
 */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** `/login`, with a safe `next` so the user lands back where they started. */
export function loginPath(next?: string): string {
  const target = safeNextPath(next, "");
  return target && target !== "/" ? `/login?next=${encodeURIComponent(target)}` : "/login";
}
