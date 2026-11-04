import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/store/fonts", () => ({ storeSerif: { variable: "font-store-serif-var" } }));
vi.mock("@/components/brand/wordmark", () => ({ Wordmark: () => null }));

import { OrderSummary } from "@/components/store/order-summary";
import { resolveTheme } from "@/components/store/store-theme";

// D-069: the checkout's order summary shows the regular price and discount only when there is one,
// and the total the buyer pays (information only; the server recomputes it).
const theme = resolveTheme({ preset: "clean", accent: "#0056FF" });
const render = (priceCents: number, salePriceCents: number | null) =>
  renderToStaticMarkup(createElement(OrderSummary, { product: { title: "UI course", coverUrl: null, priceCents, salePriceCents }, storeName: "Maya", currency: "usd", theme }));

describe("order summary (D-069)", () => {
  it("shows price, discount and total for a discounted product", () => {
    const html = render(4900, 2900);
    expect(html).toContain("$49.00");
    expect(html).toContain("−$20.00");
    expect(html).toContain("$29.00");
    expect(html).toContain("by Maya");
  });

  it("shows only the total without a discount, and Free for a free product", () => {
    const html = render(4900, null);
    expect(html).not.toContain("Discount");
    expect(html).toContain("$49.00");
    expect(render(0, null)).toContain("Free");
  });
});
