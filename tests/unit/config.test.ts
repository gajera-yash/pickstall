import { describe, expect, it } from "vitest";

import { APP_NAME, CURRENCIES, PLAN_LIMITS, PLANS, RESERVED_SLUGS, STRIPE_MIN_CHARGE, WHOLE_UNIT_CURRENCIES, ZERO_DECIMAL_CURRENCIES } from "@/lib/config";

describe("config", () => {
  it("has an app name", () => {
    expect(APP_NAME.length).toBeGreaterThan(0);
  });

  it("reserves the slugs required by PRD 5.2 and the app routes", () => {
    const prd = ["app", "www", "api", "admin", "login", "signup", "dashboard", "library", "checkout", "pricing", "terms", "privacy", "help", "support"];
    for (const slug of [...prd, "s"]) {
      expect(RESERVED_SLUGS).toContain(slug);
    }
  });

  it("stores reserved slugs lowercase and without duplicates", () => {
    expect(RESERVED_SLUGS.every((slug) => slug === slug.toLowerCase())).toBe(true);
    expect(new Set(RESERVED_SLUGS).size).toBe(RESERVED_SLUGS.length);
  });

  it("supports exactly the Phase 1 currencies", () => {
    // Stripe's presentment list (D-046): lowercase ISO codes, no duplicates, the launch markets included.
    expect(CURRENCIES).toHaveLength(134);
    expect(new Set(CURRENCIES).size).toBe(CURRENCIES.length);
    expect(CURRENCIES.every((code) => /^[a-z]{3}$/.test(code))).toBe(true);
    expect(CURRENCIES).toEqual(expect.arrayContaining(["usd", "gbp", "cad", "eur", "inr", "jpy"]));
    for (const code of [...ZERO_DECIMAL_CURRENCIES, ...WHOLE_UNIT_CURRENCIES, ...Object.keys(STRIPE_MIN_CHARGE)]) expect(CURRENCIES).toContain(code);
  });

  it("defines limits for every plan", () => {
    for (const plan of PLANS) {
      const limits = PLAN_LIMITS[plan];
      expect(limits.videoHours).toBeGreaterThan(0);
      expect(limits.emailSubscribers).toBeGreaterThan(0);
      expect(limits.maxCourses === null || limits.maxCourses > 0).toBe(true);
    }
  });
});
