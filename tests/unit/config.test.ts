import { describe, expect, it } from "vitest";

import { APP_NAME, CURRENCIES, PLAN_LIMITS, PLANS, RESERVED_SLUGS } from "@/lib/config";

describe("config", () => {
  it("has an app name", () => {
    expect(APP_NAME.length).toBeGreaterThan(0);
  });

  it("reserves the slugs required by PRD F1 and the app routes", () => {
    for (const slug of ["app", "www", "api", "admin", "login", "s", "dashboard", "library"]) {
      expect(RESERVED_SLUGS).toContain(slug);
    }
  });

  it("stores reserved slugs lowercase and without duplicates", () => {
    expect(RESERVED_SLUGS.every((slug) => slug === slug.toLowerCase())).toBe(true);
    expect(new Set(RESERVED_SLUGS).size).toBe(RESERVED_SLUGS.length);
  });

  it("supports exactly the Phase 1 currencies", () => {
    expect([...CURRENCIES]).toEqual(["usd", "gbp", "cad"]);
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
