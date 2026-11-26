import { describe, expect, it } from "vitest";

// D-133: Google Analytics only on Pickstall's own marketing and legal pages, with a valid id.

import { isTrackedPath, measurementIdOf } from "@/lib/analytics/platform";

describe("platform analytics", () => {
  it("measures only the home, sign-up, sign-in and legal pages", () => {
    for (const path of ["/", "/signup", "/login", "/cookies", "/privacy/"]) expect(isTrackedPath(path)).toBe(true);
    for (const path of ["/dashboard", "/dashboard/orders", "/admin", "/library/abc", "/@maya", "/s/maya/guide", "/welcome/token", "/signup/extra", null]) expect(isTrackedPath(path)).toBe(false);
  });

  it("accepts only a GA4 measurement id", () => {
    expect(measurementIdOf("G-FGVW6Y34SQ")).toBe("G-FGVW6Y34SQ");
    for (const value of ["", undefined, "UA-123", "G-<script>", "GTM-TG56ZLVD"]) expect(measurementIdOf(value)).toBeNull();
  });
});
