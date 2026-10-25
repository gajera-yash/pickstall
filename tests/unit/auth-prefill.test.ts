import { describe, expect, it } from "vitest";

import { signupPrefill } from "@/lib/auth/prefill";

describe("signupPrefill (untrusted metadata)", () => {
  it("reads the name and username from signup metadata", () => {
    expect(signupPrefill({ full_name: " Maya Patel ", requested_slug: "Maya-Books", phone: "+14155550100" })).toEqual({
      fullName: "Maya Patel",
      username: "maya-books",
    });
  });

  it("falls back to the Google profile name", () => {
    expect(signupPrefill({ name: "Maya Patel" })).toEqual({ fullName: "Maya Patel" });
    expect(signupPrefill({ full_name: "Maya", name: "Other" }).fullName).toBe("Maya");
  });

  it("drops a username that is invalid or reserved", () => {
    expect(signupPrefill({ requested_slug: "admin" })).toEqual({});
    expect(signupPrefill({ requested_slug: "a b" })).toEqual({});
    expect(signupPrefill({ requested_slug: "-maya" })).toEqual({});
  });

  it("drops values of the wrong type or with control characters", () => {
    expect(signupPrefill({ full_name: 42, requested_slug: ["maya"] })).toEqual({});
    expect(signupPrefill({ full_name: "Maya\u0007" })).toEqual({});
    expect(signupPrefill({ full_name: "x".repeat(200) })).toEqual({});
  });

  it.each([undefined, null, "text", 5, []])("returns nothing for %j", (input) => {
    expect(signupPrefill(input)).toEqual({});
  });
});
