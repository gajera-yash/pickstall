import { describe, expect, it } from "vitest";

import { RESERVED_SLUGS } from "@/lib/config";
import { isReservedSlug, normalizeSlugInput, SLUG_TAKEN_MESSAGE, slugSchema } from "@/lib/slug";

describe("slugSchema", () => {
  it.each(["maya", "maya-books", "a1b", "123", "my-store-2026", "a".repeat(30)])("accepts %s", (input) => {
    expect(slugSchema.safeParse(input).success).toBe(true);
  });

  it("trims and lowercases", () => {
    expect(slugSchema.parse("  Maya-Books ")).toBe("maya-books");
  });

  it.each([
    ["too short", "ab", "Use 3 to 30 characters."],
    ["too long", "a".repeat(31), "Use 3 to 30 characters."],
    ["empty", "", "Use 3 to 30 characters."],
    ["a space", "maya books", "Use only letters, numbers and hyphens."],
    ["an underscore", "maya_books", "Use only letters, numbers and hyphens."],
    ["a dot", "maya.books", "Use only letters, numbers and hyphens."],
    ["an accent", "mayás", "Use only letters, numbers and hyphens."],
    ["a leading hyphen", "-maya", "Start and end with a letter or number."],
    ["a trailing hyphen", "maya-", "Start and end with a letter or number."],
    ["hyphens in positions 3 and 4", "ab--cd", "Use only letters, numbers and single hyphens."],
  ])("rejects %s with a clear message", (_label, input, message) => {
    const result = slugSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it("rejects every reserved name with the same message as a taken one", () => {
    for (const reserved of RESERVED_SLUGS.filter((slug) => slug.length >= 3)) {
      const result = slugSchema.safeParse(reserved.toUpperCase());
      expect(result.success, reserved).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(SLUG_TAKEN_MESSAGE);
    }
  });

  it("knows the one-letter reserved name too", () => {
    expect(RESERVED_SLUGS).toContain("s");
    expect(isReservedSlug("S")).toBe(true);
    expect(isReservedSlug("maya")).toBe(false);
  });

  it("is stricter than the database check only for edge hyphens", () => {
    const dbPattern = /^[a-z0-9-]{3,30}$/;
    for (const slug of ["maya", "a-b", "abc", "x".repeat(30)]) {
      expect(dbPattern.test(slug)).toBe(true);
      expect(slugSchema.safeParse(slug).success).toBe(true);
    }
    for (const slug of ["-ab", "ab-"]) {
      expect(dbPattern.test(slug)).toBe(true);
      expect(slugSchema.safeParse(slug).success).toBe(false);
    }
  });
});

describe("normalizeSlugInput", () => {
  it.each([
    ["Maya Books", "maya-books"],
    ["maya_books", "maya-books"],
    ["  maya  ", "-maya-"],
    ["MAYA!@#", "maya"],
    ["mayá", "may"],
    ["", ""],
    ["a".repeat(40), "a".repeat(30)],
  ])("turns %j into %j", (input, expected) => {
    expect(normalizeSlugInput(input)).toBe(expected);
  });
});
