import { describe, expect, it } from "vitest";

import { checkEmailFormat } from "@/lib/auth/email-format";

describe("checkEmailFormat", () => {
  it("stays quiet while the field is empty", () => {
    expect(checkEmailFormat("")).toEqual({ status: "empty" });
    expect(checkEmailFormat("   ")).toEqual({ status: "empty" });
  });

  it("accepts what the server accepts, including spaces and capitals it cleans up", () => {
    expect(checkEmailFormat("maya@example.com")).toEqual({ status: "valid" });
    expect(checkEmailFormat("  Maya@Example.COM ")).toEqual({ status: "valid" });
  });

  it("flags addresses the server would reject, with the server's message", () => {
    for (const bad of ["maya", "maya@", "maya@example", "@example.com", "maya example@x.com"]) {
      expect(checkEmailFormat(bad)).toEqual({ status: "invalid", message: "Enter a valid email address." });
    }
    expect(checkEmailFormat(`${"a".repeat(250)}@x.com`)).toMatchObject({ status: "invalid" });
  });
});
