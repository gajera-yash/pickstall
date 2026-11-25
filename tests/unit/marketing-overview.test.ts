import { beforeEach, describe, expect, it, vi } from "vitest";

// D-129: the Marketing overview's status per tool, and the Marketing sub-nav.

const q = vi.hoisted(() => ({
  listCoupons: vi.fn(),
  countSubscribed: vi.fn(),
  listBroadcasts: vi.fn(),
  findEmailLook: vi.fn(),
  findWelcomeEmail: vi.fn(),
  findCartSettings: vi.fn(),
  cartStats: vi.fn(),
  findReviewRequestSettings: vi.fn(),
  listAffiliates: vi.fn(),
  findPixelSettings: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/coupons/queries", () => ({ listCoupons: q.listCoupons }));
vi.mock("@/lib/subscribers/queries", () => ({ countSubscribed: q.countSubscribed }));
vi.mock("@/lib/broadcasts/queries", () => ({ listBroadcasts: q.listBroadcasts, findWelcomeEmail: q.findWelcomeEmail }));
vi.mock("@/lib/stores/queries", () => ({ findEmailLook: q.findEmailLook }));
vi.mock("@/lib/abandoned-cart/queries", () => ({ findCartSettings: q.findCartSettings, cartStats: q.cartStats }));
vi.mock("@/lib/review-request/queries", () => ({ findReviewRequestSettings: q.findReviewRequestSettings }));
vi.mock("@/lib/affiliates/queries", () => ({ listAffiliates: q.listAffiliates }));
vi.mock("@/lib/pixels/queries", () => ({ findPixelSettings: q.findPixelSettings }));

import { MARKETING_SECTIONS, breadcrumbFor, isMarketingSectionActive } from "@/lib/dashboard/nav";
import { couponIsLive, marketingOverview, offerCounts } from "@/lib/marketing/overview";
import type { CreatorProduct } from "@/lib/products/queries";

const NOW = new Date("2026-11-25T12:00:00Z");
const coupon = (change: Partial<{ active: boolean; expiresAt: Date | null; maxRedemptions: number | null; redemptionCount: number }> = {}) => ({ active: true, expiresAt: null, maxRedemptions: null, redemptionCount: 0, ...change });
const offer = { productId: "p2", priceCents: 900, headline: null };

beforeEach(() => {
  vi.clearAllMocks();
  q.listCoupons.mockResolvedValue([coupon(), coupon({ active: false }), coupon({ expiresAt: new Date("2026-11-01") }), coupon({ maxRedemptions: 5, redemptionCount: 5 })]);
  q.countSubscribed.mockResolvedValue(120);
  q.listBroadcasts.mockResolvedValue([{ createdAt: new Date("2026-11-19") }]);
  q.findEmailLook.mockResolvedValue("bold");
  q.findWelcomeEmail.mockResolvedValue(null);
  q.findCartSettings.mockResolvedValue({ enabled: true, subject: "", body: "" });
  q.cartStats.mockResolvedValue({ sent: 4, recovered: 1 });
  q.findReviewRequestSettings.mockRejectedValue(new Error("db down"));
  q.listAffiliates.mockResolvedValue([{ active: true }, { active: false }]);
  q.findPixelSettings.mockResolvedValue({ metaPixelId: "123", googleTagId: null });
});

describe("marketing overview", () => {
  it("counts only coupons buyers can use now", () => {
    expect(couponIsLive(coupon(), NOW)).toBe(true);
    expect(couponIsLive(coupon({ active: false }), NOW)).toBe(false);
    expect(couponIsLive(coupon({ expiresAt: new Date("2026-11-01") }), NOW)).toBe(false);
    expect(couponIsLive(coupon({ maxRedemptions: 5, redemptionCount: 5 }), NOW)).toBe(false);
  });

  it("counts offers on products that are not archived", () => {
    const products = [
      { status: "published", bump: offer, upsell: offer, downsell: null },
      { status: "draft", bump: null, upsell: offer, downsell: offer },
      { status: "archived", bump: offer, upsell: offer, downsell: offer },
    ] as unknown as CreatorProduct[];
    expect(offerCounts(products)).toEqual({ bumps: 1, upsells: 2, downsells: 1 });
  });

  it("reads every status for the store, and shows unknown instead of failing", async () => {
    const data = await marketingOverview("store-a", "user-a", [], NOW);
    expect(q.listCoupons).toHaveBeenCalledWith("store-a");
    expect(q.findEmailLook).toHaveBeenCalledWith("user-a");
    expect(data).toMatchObject({
      coupons: { active: 1 },
      subscribers: 120,
      emailLook: "bold",
      welcomeOn: false,
      cart: { on: true, sent: 4, recovered: 1 },
      reviewOn: null,
      affiliates: { active: 1 },
      pixels: { meta: true, google: false },
    });
    expect(data.lastBroadcastAt).toEqual(new Date("2026-11-19"));
  });
});

describe("marketing sub-nav", () => {
  it("marks the overview only on its own page and each tool on its sub-pages", () => {
    expect(isMarketingSectionActive("/dashboard/marketing", "/dashboard/marketing")).toBe(true);
    expect(isMarketingSectionActive("/dashboard/marketing/coupons", "/dashboard/marketing")).toBe(false);
    expect(isMarketingSectionActive("/dashboard/marketing/coupons", "/dashboard/marketing/coupons")).toBe(true);
    expect(MARKETING_SECTIONS.map((section) => section.id)).toContain("automations");
  });

  it("adds the tool to the breadcrumb", () => {
    expect(breadcrumbFor("/dashboard/marketing").map((crumb) => crumb.label)).toEqual(["Marketing"]);
    expect(breadcrumbFor("/dashboard/marketing/automations").map((crumb) => crumb.label)).toEqual(["Marketing", "Automations"]);
  });
});
