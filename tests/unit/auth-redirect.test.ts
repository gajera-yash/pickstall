import { describe, expect, it } from "vitest";

import { loginPath, safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  it.each([
    ["/", "/"],
    ["/dashboard", "/dashboard"],
    ["/library/abc?tab=files#top", "/library/abc?tab=files#top"],
    ["/a/../b", "/b"],
  ])("keeps same-origin path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    ["absolute URL", "https://evil.test/phish"],
    ["protocol-relative", "//evil.test"],
    ["backslash trick", "/\\evil.test"],
    ["javascript URL", "javascript:alert(1)"],
    ["relative path", "dashboard"],
    ["control character", "/dash\nboard"],
    ["tab trick", "/\t/evil.test"],
    ["empty", ""],
    ["too long", `/${"a".repeat(3000)}`],
    ["not a string", 42],
    ["null", null],
  ])("falls back for %s", (_label, input) => {
    expect(safeNextPath(input)).toBe("/");
  });

  it("uses the given fallback", () => {
    expect(safeNextPath("https://evil.test", "/library")).toBe("/library");
  });
});

describe("loginPath", () => {
  it("adds a safe next path", () => {
    expect(loginPath("/dashboard?x=1")).toBe("/login?next=%2Fdashboard%3Fx%3D1");
  });

  it("drops unsafe or empty next values", () => {
    expect(loginPath("//evil.test")).toBe("/login");
    expect(loginPath()).toBe("/login");
    expect(loginPath("/")).toBe("/login");
  });
});
