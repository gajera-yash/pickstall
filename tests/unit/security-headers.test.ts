import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, PAGE_CSP_SOURCE, securityHeaders, STORE_CSP_SOURCE } from "@/lib/security/headers";

const header = (isDev: boolean, key: string) => securityHeaders(isDev).find((h) => h.key === key)?.value;

describe("securityHeaders", () => {
  it("blocks framing and MIME sniffing everywhere", () => {
    for (const isDev of [true, false]) {
      expect(header(isDev, "X-Frame-Options")).toBe("DENY");
      expect(header(isDev, "X-Content-Type-Options")).toBe("nosniff");
      expect(header(isDev, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    }
  });

  it("sends HSTS and COOP in production only (they need https)", () => {
    expect(header(false, "Strict-Transport-Security")).toMatch(/^max-age=\d{8,}/);
    expect(header(true, "Strict-Transport-Security")).toBeUndefined();
    expect(header(false, "Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(header(true, "Cross-Origin-Opener-Policy")).toBeUndefined();
  });
});

describe("contentSecurityPolicy", () => {
  const prod = contentSecurityPolicy(false);
  const dev = contentSecurityPolicy(true);

  it("forbids framing, plugins and foreign base URLs", () => {
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("base-uri 'self'");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("loads scripts only from our own origin and Google Analytics' tag host (D-133)", () => {
    expect(prod).toContain("script-src 'self' 'unsafe-inline' https://www.googletagmanager.com;");
    expect(prod).toContain("connect-src 'self' https://video.bunnycdn.com https://*.r2.cloudflarestorage.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com;");
    expect(prod).not.toContain("unsafe-eval");
    expect(prod).not.toMatch(/script-src[^;]*https:(?!\/\/www\.googletagmanager\.com)/);
  });

  it("allows eval and the hot-reload socket in development only", () => {
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("connect-src 'self' https://video.bunnycdn.com https://*.r2.cloudflarestorage.com ws: wss:");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  it("lets forms redirect to https (Stripe Checkout, the creator's delivery link)", () => {
    expect(prod).toContain("form-action 'self' https:");
  });

  it("leaves uploaded images to their own stricter policy", () => {
    const matcher = new RegExp(`^${PAGE_CSP_SOURCE}$`);
    expect(matcher.test("/dashboard")).toBe(true);
    expect(matcher.test("/settings")).toBe(true);
    expect(matcher.test("/signup")).toBe(true);
    expect(matcher.test("/media/0b9e8d2c-1111-4222-8333-444455556666")).toBe(false);
  });

  it("gives store pages their own CSP with the pixel hosts, and no page gets both (D-097)", () => {
    const page = new RegExp(`^${PAGE_CSP_SOURCE}$`);
    const storeMatcher = new RegExp(`^${STORE_CSP_SOURCE}$`);
    for (const path of ["/@maya", "/@maya/playbook", "/@maya/playbook/checkout", "/s/maya/playbook/thank-you"]) {
      expect(storeMatcher.test(path)).toBe(true);
      expect(page.test(path)).toBe(false);
    }
    for (const path of ["/dashboard", "/library", "/settings"]) expect(storeMatcher.test(path)).toBe(false);
    const store = contentSecurityPolicy(false, { pixels: true });
    expect(store).toContain("https://connect.facebook.net");
    expect(store).toContain("https://www.googletagmanager.com");
    // Pickstall's own pages never get the creators' Meta pixel host.
    expect(prod).not.toContain("facebook");
  });
});
