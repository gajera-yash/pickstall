import { describe, expect, it } from "vitest";

import { normalizeCodeInput } from "@/lib/auth/code";
import { composePhone, countryFromLocale, phoneCountryOptions } from "@/lib/phone";
import { slugSchema, usernameCandidates } from "@/lib/slug";

describe("normalizeCodeInput (pasting into the code boxes)", () => {
  it("keeps digits only and caps the length", () => {
    expect(normalizeCodeInput("123-456")).toBe("123456");
    expect(normalizeCodeInput(" 12 34 56 78")).toBe("123456");
    expect(normalizeCodeInput("abc")).toBe("");
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

describe("countryFromLocale", () => {
  it("reads the region of a listed country", () => {
    expect(countryFromLocale("en-IN")).toBe("IN");
    expect(countryFromLocale("en_GB")).toBe("GB");
  });

  it("reads any country, not only a short list", () => {
    expect(countryFromLocale("fr-SN")).toBe("SN");
  });

  it("falls back to the US", () => {
    expect(countryFromLocale("en")).toBe("US");
    expect(countryFromLocale("xx-ZZ")).toBe("US");
    expect(countryFromLocale(undefined)).toBe("US");
  });
});

describe("phoneCountryOptions", () => {
  it("lists every country with its dial code, sorted by name", () => {
    const options = phoneCountryOptions();
    expect(options.length).toBeGreaterThan(200);
    expect(options.find((option) => option.country === "IN")).toEqual({ country: "IN", dial: "91", name: "India" });
    const names = options.map((option) => option.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });
});
