import { describe, expect, it } from "vitest";

import { E164_PATTERN, normalizePhone, optionalPhoneSchema } from "@/lib/phone";

describe("normalizePhone", () => {
  it.each([
    ["+1 415 555 0100", "+14155550100"],
    ["+44 (20) 7946-0958", "+442079460958"],
    ["+91.98765.43210", "+919876543210"],
    ["0044 20 7946 0958", "+442079460958"],
    ["  +1 415 555 0100  ", "+14155550100"],
    ["", ""],
  ])("turns %j into %j", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});

describe("optionalPhoneSchema", () => {
  it("treats empty or blank input as no phone number", () => {
    expect(optionalPhoneSchema.parse("")).toBeUndefined();
    expect(optionalPhoneSchema.parse("   ")).toBeUndefined();
  });

  it("returns the number in international format", () => {
    expect(optionalPhoneSchema.parse("+1 (415) 555-0100")).toBe("+14155550100");
  });

  it.each([
    ["no country code", "4155550100"],
    ["too short", "+12345"],
    ["too long", "+1234567890123456"],
    ["letters", "+1415abc0100"],
    ["a leading zero country code", "+0415555010"],
    ["an injection attempt", "+14155550100; drop table"],
  ])("rejects %s with the country-code hint", (_label, input) => {
    const result = optionalPhoneSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("country code");
  });

  it("matches the pattern used by the database check", () => {
    expect(E164_PATTERN.source).toBe("^\\+[1-9]\\d{6,14}$");
  });
});
