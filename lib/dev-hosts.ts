// Running the dev server from any machine (D-041). Next.js only serves its dev resources (scripts,
// hot reload) to `localhost`, so opening the app as 127.0.0.1, from Antigravity's preview or from
// another PC on the network breaks typing and navigation. In DEVELOPMENT ONLY, these helpers allow
// loopback and private-network hosts. Production never trusts the Host header (NEXT_PUBLIC_APP_URL).
// Pure and dependency-free, so next.config.ts and the unit tests can import it.

/**
 * Patterns for Next's `allowedDevOrigins` (one `*` per dot-separated part). Loopback, the private
 * IPv4 ranges (172.* is wider than 172.16/12, which is fine for a dev server) and mDNS names.
 */
export const DEV_HOST_PATTERNS = ["127.0.0.1", "[::1]", "10.*.*.*", "172.*.*.*", "192.168.*.*", "*.local"] as const;

/** Extra dev hosts from `DEV_ALLOWED_HOSTS` (comma separated), for a tunnel or a named machine. */
export function extraDevHosts(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => /^[a-z0-9*.:[\]-]{1,253}$/.test(host));
}

/** Everything the dev server should serve to: the patterns, this machine's name and the extras. */
export function devAllowedOrigins(machineName: string | undefined, extra: string | undefined): string[] {
  const name = machineName?.trim().toLowerCase();
  return [...DEV_HOST_PATTERNS, ...(name && /^[a-z0-9-]{1,63}$/.test(name) ? [name, `${name}.local`] : []), ...extraDevHosts(extra)];
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [a, b] = parts.map(Number) as [number, number, number, number];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/**
 * Is this hostname a local or private-network address a developer might open the app from?
 * `hostname` has no port. Extra hosts match exactly.
 */
export function isLocalDevHost(hostname: string, extra: readonly string[] = []): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "[::1]" || host === "::1") return true;
  if (isPrivateIpv4(host)) return true;
  if (/^[a-z0-9-]{1,63}$/.test(host) && !host.includes(".")) return true; // a bare machine name on the LAN
  return extra.includes(host);
}

/**
 * The origin to build links and redirects from. In development, when the request came in through a
 * local or private host, that host (so a phone or a second PC is sent back to the same address).
 * Otherwise, and always in production, the configured NEXT_PUBLIC_APP_URL.
 */
export function resolveAppOrigin(input: {
  configured: string;
  isDev: boolean;
  host: string | null;
  forwardedProto: string | null;
  extra?: readonly string[];
}): string {
  const configured = new URL(input.configured).origin;
  if (!input.isDev || !input.host) return configured;
  let url: URL;
  try {
    url = new URL(`http://${input.host}`);
  } catch {
    return configured;
  }
  if (url.username || url.password || url.pathname !== "/" || !isLocalDevHost(url.hostname, input.extra)) return configured;
  const proto = input.forwardedProto?.split(",")[0]?.trim() === "https" ? "https" : "http";
  return `${proto}://${url.host}`;
}
