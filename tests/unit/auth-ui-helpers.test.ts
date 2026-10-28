import { describe, expect, it } from "vitest";

import { enterCodeDigits, eraseCodeDigit } from "@/lib/auth/code";
import { composePhone, regionFromLocale } from "@/lib/phone";
import { slugSchema, usernameCandidates } from "@/lib/slug";

describe("enterCodeDigits", () => {
  it("types one digit and moves to the next box", () => {
    expect(enterCodeDigits("12", 2, "3")).toEqual({ code: "123", focus: 3 });
  });

  it("replaces a digit in a filled box", () => {
    expect(enterCodeDigits("123456", 1, "9")).toEqual({ code: "193456", focus: 2 });
  });

  it("fills every box from a paste, ignoring spaces and dashes", () => {
    expect(enterCodeDigits("", 0, "123-456")).toEqual({ code: "123456", focus: 5 });
  });

  it("never leaves a gap when typing into a later box", () => {
    expect(enterCodeDigits("1", 4, "2")).toEqual({ code: "12", focus: 2 });
  });

  it("caps at six digits and ignores letters", () => {
    expect(enterCodeDigits("12345", 5, "6789").code).toBe("123456");
    expect(enterCodeDigits("12", 2, "a")).toEqual({ code: "12", focus: 2 });
  });
});

describe("eraseCodeDigit", () => {
  it("clears the current box", () => {
    expect(eraseCodeDigit("123", 1)).toEqual({ code: "13", focus: 1 });
  });

  it("clears the previous box when the current one is empty", () => {
    expect(eraseCodeDigit("123", 3)).toEqual({ code: "12", focus: 2 });
    expect(eraseCodeDigit("", 0)).toEqual({ code: "", focus: 0 });
  });
});

describe("usernameCandidates", () => {
  it("offers valid alternatives in order", () => {
    expect(usernameCandidates("maya").slice(0, 3)).toEqual(["maya-official", "maya-store", "hey-maya"]);
  });

  it("keeps every candidate within the username rules", () => {
    for (const candidate of usernameCandidates("a-very-long-username-that-hits-it")) {
      expect(slugSchema.safeParse(candidate).success, candidate).toBe(true);
    }
  });

  it("returns nothing for an empty base", () => {
    expect(usernameCandidates("---")).toEqual([]);
  });
});

describe("composePhone", () => {
  it("joins the country code and the national number", () => {
    expect(composePhone("IN", "98765 43210")).toBe("+919876543210");
    expect(composePhone("GB", "07700 900123")).toBe("+447700900123");
  });

  it("keeps a number typed with its own country code", () => {
    expect(composePhone("IN", "+1 415 555 0100")).toBe("+14155550100");
  });

  it("stays empty when nothing is typed", () => {
    expect(composePhone("US", "  ")).toBe("");
  });
});

describe("regionFromLocale", () => {
  it("reads the region of a listed country", () => {
    expect(regionFromLocale("en-IN")).toBe("IN");
    expect(regionFromLocale("en_GB")).toBe("GB");
  });

  it("falls back to the US", () => {
    expect(regionFromLocale("en")).toBe("US");
    expect(regionFromLocale("xx-ZZ")).toBe("US");
    expect(regionFromLocale(undefined)).toBe("US");
  });
});
