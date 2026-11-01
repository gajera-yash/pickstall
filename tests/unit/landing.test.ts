import { describe, expect, it } from "vitest";

import {
  CALCULATOR,
  DEMO_PRODUCTS,
  STALL_NAME_MAX,
  cleanStallName,
  compareFees,
  formatWholeDollars,
  initialsOf,
  nextSale,
  snapSales,
} from "@/lib/landing/demo";

describe("cleanStallName", () => {
  it("removes markup and control characters and caps the length", () => {
    expect(cleanStallName("<b>Maya</b>\n Studio")).toBe("bMaya/b Studio");
    expect(cleanStallName("x".repeat(50))).toHaveLength(STALL_NAME_MAX);
    expect(cleanStallName("   Maya   Studio")).toBe("Maya Studio");
  });
});

describe("initialsOf", () => {
  it("takes up to two initials and falls back to P", () => {
    expect(initialsOf("Maya's Money Studio")).toBe("MM");
    expect(initialsOf("solo")).toBe("S");
    expect(initialsOf("   ")).toBe("P");
  });
});

describe("nextSale", () => {
  it("rotates through the stocked products and needs at least one", () => {
    const stocked = DEMO_PRODUCTS.slice(0, 2);
    expect(nextSale(stocked, 0)?.id).toBe(stocked[0]?.id);
    expect(nextSale(stocked, 1)?.id).toBe(stocked[1]?.id);
    expect(nextSale(stocked, 2)?.id).toBe(stocked[0]?.id);
    expect(nextSale([], 0)).toBeNull();
  });
});

describe("compareFees", () => {
  it("shows the assumed 10% cut against a zero platform fee, in integer cents", () => {
    expect(compareFees(300_000)).toEqual({ salesCents: 300_000, cutCents: 30_000, platformFeeCents: 0, yearlyCutCents: 360_000 });
    expect(compareFees(12_345).cutCents).toBe(1235);
    expect(Number.isInteger(compareFees(99_999).cutCents)).toBe(true);
  });

  it("never goes negative", () => {
    expect(compareFees(-500).cutCents).toBe(0);
  });
});

describe("snapSales", () => {
  it("keeps the slider value inside the range and on the step", () => {
    expect(snapSales(10)).toBe(CALCULATOR.minCents);
    expect(snapSales(99_999_999)).toBe(CALCULATOR.maxCents);
    expect(snapSales(310_000)).toBe(300_000);
    expect(snapSales(Number.NaN)).toBe(CALCULATOR.defaultCents);
  });
});

describe("formatWholeDollars", () => {
  it("formats big round numbers without cents", () => {
    expect(formatWholeDollars(300_000)).toBe("$3,000");
  });
});
