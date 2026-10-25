import { describe, expect, it } from "vitest";

import { emailCodeSchema, emailSchema } from "@/lib/auth/schemas";

describe("emailSchema", () => {
  it("trims and lowercases", () => {
    expect(emailSchema.parse("  Maya@Example.COM ")).toBe("maya@example.com");
  });

  it.each(["", "maya", "maya@", "@example.com", `${"a".repeat(250)}@example.com`])("rejects %s", (input) => {
    expect(emailSchema.safeParse(input).success).toBe(false);
  });
});

describe("emailCodeSchema", () => {
  it("accepts 6 digits and ignores spaces", () => {
    expect(emailCodeSchema.parse("123456")).toBe("123456");
    expect(emailCodeSchema.parse(" 123 456 ")).toBe("123456");
  });

  it.each(["12345", "1234567", "12a456", "", "١٢٣٤٥٦"])("rejects %s", (input) => {
    expect(emailCodeSchema.safeParse(input).success).toBe(false);
  });
});
