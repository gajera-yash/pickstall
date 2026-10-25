import { describe, expect, it } from "vitest";

import { createStoreInput, storeBioSchema, storeNameSchema } from "@/lib/stores/schemas";
import { hasControlChar } from "@/lib/text";

describe("hasControlChar", () => {
  it("finds control characters but not normal text", () => {
    expect(hasControlChar("Maya Patel")).toBe(false);
    expect(hasControlChar("Maya\u0007")).toBe(true);
    expect(hasControlChar("a\u007fb")).toBe(true);
    expect(hasControlChar("")).toBe(false);
  });

  it("can allow line breaks", () => {
    expect(hasControlChar("line one\nline two")).toBe(true);
    expect(hasControlChar("line one\r\nline two", { allowNewlines: true })).toBe(false);
    expect(hasControlChar("tab\there", { allowNewlines: true })).toBe(true);
  });
});

describe("storeNameSchema", () => {
  it("trims and accepts normal names", () => {
    expect(storeNameSchema.parse("  Maya's Budget Studio ")).toBe("Maya's Budget Studio");
  });

  it.each([
    ["empty", "   ", "Enter a store name."],
    ["too long", "x".repeat(61), "Use 60 characters or fewer."],
    ["a control character", "Maya\u0007", "Remove the special characters from the name."],
  ])("rejects %s", (_label, input, message) => {
    const result = storeNameSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});

describe("storeBioSchema", () => {
  it("turns an empty bio into undefined", () => {
    expect(storeBioSchema.parse("")).toBeUndefined();
    expect(storeBioSchema.parse("   ")).toBeUndefined();
  });

  it("keeps line breaks inside a bio", () => {
    expect(storeBioSchema.parse("Line one\nLine two")).toBe("Line one\nLine two");
  });

  it("rejects an over-long bio and control characters", () => {
    expect(storeBioSchema.safeParse("x".repeat(201)).success).toBe(false);
    expect(storeBioSchema.safeParse("bad\u0000bio").success).toBe(false);
  });
});

describe("createStoreInput", () => {
  const valid = { name: "Maya", username: "Maya-Books", currency: "usd", bio: "" };

  it("accepts the supported currencies only", () => {
    for (const currency of ["usd", "gbp", "cad"]) expect(createStoreInput.safeParse({ ...valid, currency }).success).toBe(true);
    for (const currency of ["eur", "USD", "", undefined]) expect(createStoreInput.safeParse({ ...valid, currency }).success).toBe(false);
  });

  it("reports problems in form order", () => {
    const result = createStoreInput.safeParse({ name: "", username: "x", currency: "zzz", bio: "y".repeat(300) });
    const fields = [...new Set(result.error?.issues.map((issue) => issue.path[0]))];
    expect(fields).toEqual(["name", "username", "currency", "bio"]);
  });

  it("cleans the username and bio", () => {
    expect(createStoreInput.parse(valid)).toEqual({ name: "Maya", username: "maya-books", currency: "usd", bio: undefined });
  });
});
