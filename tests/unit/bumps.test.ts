import { describe, expect, it } from "vitest";

import { bumpInputFor, withBump } from "@/lib/bumps/rules";

// Order bumps (D-089): the creator's settings and the order amounts with a bump.

const PRODUCT = "8e2f9a3b-0000-4000-8000-000000000001";
const parse = (overrides: Record<string, unknown> = {}) => bumpInputFor("usd").safeParse({ enabled: true, productId: PRODUCT, price: "9", headline: "  Add the <b>workbook</b> ", ...overrides });

describe("bump settings", () => {
  it("reads the product, the price in cents and a cleaned headline", () => {
    expect(parse().data).toEqual({ productId: PRODUCT, priceCents: 900, headline: "Add the workbook" });
  });

  it("is null when turned off, whatever else is filled in", () => {
    expect(parse({ enabled: false, productId: "", price: "" }).data).toBeNull();
  });

  it.each([
    [{ productId: "" }, "productId"],
    [{ productId: "not-a-uuid" }, "productId"],
    [{ price: "" }, "price"],
    [{ price: "0" }, "price"],
    [{ price: "0.10" }, "price"],
  ])("rejects %o on %s", (overrides, field) => {
    const result = parse(overrides);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path[0]).toBe(field);
  });
});

describe("order amounts with a bump", () => {
  it("adds the bump price to the subtotal and the total, not the discount", () => {
    expect(withBump({ subtotalCents: 3000, discountCents: 1000, totalCents: 2000 }, 900)).toEqual({ subtotalCents: 3900, discountCents: 1000, totalCents: 2900 });
  });
});
