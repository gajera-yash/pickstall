import { describe, expect, it } from "vitest";

import { couponDiscountCents, couponInputFor, couponLabel, couponProblem, normalizeCode, totalProblem } from "@/lib/coupons/rules";
import { orderAmounts } from "@/lib/orders/pricing";

// Coupons (D-088): the discount math, the usability checks and the creator form.

const now = new Date("2026-11-18T10:00:00Z");
const open = { active: true, expiresAt: null, productIds: null, maxRedemptions: null, redemptionCount: 0 };

describe("coupon math", () => {
  it("takes a percentage (rounded down) or a fixed amount, never more than the price", () => {
    expect(couponDiscountCents(1999, { kind: "percent", percentOff: 20, amountOffCents: null })).toBe(399);
    expect(couponDiscountCents(1000, { kind: "percent", percentOff: 100, amountOffCents: null })).toBe(1000);
    expect(couponDiscountCents(1000, { kind: "amount", percentOff: null, amountOffCents: 500 })).toBe(500);
    expect(couponDiscountCents(300, { kind: "amount", percentOff: null, amountOffCents: 500 })).toBe(300);
    expect(couponDiscountCents(0, { kind: "percent", percentOff: 50, amountOffCents: null })).toBe(0);
  });

  it("applies on top of a sale price, and the order records both discounts", () => {
    expect(orderAmounts({ priceCents: 3000, salePriceCents: 2000 }, 500)).toEqual({ subtotalCents: 3000, discountCents: 1500, totalCents: 1500 });
    expect(orderAmounts({ priceCents: 3000, salePriceCents: null }, 9999)).toEqual({ subtotalCents: 3000, discountCents: 3000, totalCents: 0 });
    expect(orderAmounts({ priceCents: 3000, salePriceCents: null })).toEqual({ subtotalCents: 3000, discountCents: 0, totalCents: 3000 });
  });

  it("refuses a total below Stripe's minimum charge, but allows free", () => {
    expect(totalProblem(0, "usd")).toBeNull();
    expect(totalProblem(10, "usd")).toMatch(/below the minimum charge/);
    expect(totalProblem(500, "usd")).toBeNull();
  });

  it("labels the discount", () => {
    expect(couponLabel({ kind: "percent", percentOff: 15, amountOffCents: null }, "usd")).toBe("15% off");
    expect(couponLabel({ kind: "amount", percentOff: null, amountOffCents: 500 }, "usd")).toBe("$5.00 off");
  });
});

describe("couponProblem", () => {
  it("accepts an active, unexpired coupon under its limit", () => {
    expect(couponProblem(open, "p1", now)).toBeNull();
  });

  it.each([
    [null, "This code isn't valid."],
    [{ ...open, active: false }, "This code isn't valid."],
    [{ ...open, expiresAt: new Date("2026-11-18T09:00:00Z") }, "This code has expired."],
    [{ ...open, productIds: ["p2"] }, "This code doesn't work for this product."],
    [{ ...open, maxRedemptions: 3, redemptionCount: 3 }, "This code has been used up."],
  ])("refuses %o", (coupon, message) => {
    expect(couponProblem(coupon, "p1", now)).toBe(message);
  });
});

describe("creator coupon form", () => {
  const base = { code: " save20 ", kind: "percent", percentOff: "20", amountOff: "", productIds: null, maxRedemptions: "", oncePerEmail: false, expiresAt: "" };
  const parse = (overrides: Record<string, unknown> = {}) => couponInputFor("usd").safeParse({ ...base, ...overrides });

  it("normalizes the code and reads the discount", () => {
    expect(normalizeCode(" diwali20 ")).toBe("DIWALI20");
    expect(parse().data).toMatchObject({ code: "SAVE20", kind: "percent", percentOff: 20, amountOffCents: null, maxRedemptions: null, expiresAt: null, productIds: null });
    expect(parse({ kind: "amount", amountOff: "5.50", maxRedemptions: "10", expiresAt: "2026-12-31T18:29:59.000Z" }).data).toMatchObject({ amountOffCents: 550, percentOff: null, maxRedemptions: 10 });
  });

  it.each([
    [{ code: "AB" }, "code"],
    [{ code: "HAS SPACE" }, "code"],
    [{ code: "<script>" }, "code"],
    [{ percentOff: "0" }, "percentOff"],
    [{ percentOff: "101" }, "percentOff"],
    [{ kind: "amount", amountOff: "0" }, "amountOff"],
    [{ maxRedemptions: "0" }, "maxRedemptions"],
    [{ expiresAt: "someday" }, "expiresAt"],
    [{ productIds: ["not-a-uuid"] }, "productIds"],
  ])("rejects %o on %s", (overrides, field) => {
    const result = parse(overrides);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path[0]).toBe(field);
  });
});

describe("checkout summary total (D-090)", () => {
  it("follows an applied coupon and a ticked bump", async () => {
    const { summaryTotalCents } = await import("@/components/store/checkout-totals");
    expect(summaryTotalCents(150000, null, null)).toBe(150000);
    expect(summaryTotalCents(150000, { totalCents: 135000 }, null)).toBe(135000);
    expect(summaryTotalCents(150000, { totalCents: 135000 }, 90000)).toBe(225000);
    expect(summaryTotalCents(0, null, 90000)).toBe(90000);
  });
});
