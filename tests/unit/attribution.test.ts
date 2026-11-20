import { beforeEach, describe, expect, it, vi } from "vitest";

// D-112: sales attribution rules and the "Where sales come from" query.

const db = vi.hoisted(() => ({ orders: { aggregate: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));

import { attributionFrom, referrerHostOf, sourceOfHost } from "@/lib/analytics/attribution";
import { salesBySource } from "@/lib/orders/creator-queries";

describe("attribution rules", () => {
  it("prefer the UTM source, cleaned and lower case", () => {
    expect(attributionFrom({ source: " YouTube ", medium: "Video", campaign: "<i>Black Friday</i>", referrer: "www.google.com" }, "pickstall.store")).toEqual({
      source: "youtube",
      medium: "video",
      campaign: "black friday",
      referrer: "google.com",
    });
  });

  it("fall back to a known name for the referring site, or its host", () => {
    expect(attributionFrom({ referrer: "l.instagram.com" }, "pickstall.store")).toEqual({ source: "instagram", medium: null, campaign: null, referrer: "l.instagram.com" });
    expect(attributionFrom({ referrer: "t.co" }, "pickstall.store")?.source).toBe("x");
    expect(attributionFrom({ referrer: "myblog.example" }, "pickstall.store")?.source).toBe("myblog.example");
    expect(sourceOfHost("m.youtube.com")).toBe("youtube");
    expect(sourceOfHost("google.co.in")).toBe("google");
  });

  it("treat our own pages, junk and nothing at all as direct", () => {
    expect(attributionFrom({ referrer: "pickstall.store" }, "pickstall.store")).toBeNull();
    expect(attributionFrom({ referrer: "www.pickstall.store" }, "pickstall.store")).toBeNull();
    expect(attributionFrom({ referrer: "javascript:alert(1)" }, "pickstall.store")).toBeNull();
    expect(attributionFrom({ source: 42, referrer: null }, "pickstall.store")).toBeNull();
    expect(attributionFrom({}, "localhost:3000")).toBeNull();
  });

  it("keep only a host from a full address, and cap every label", () => {
    expect(referrerHostOf("https://www.instagram.com/p/abc?igsh=123")).toBe("instagram.com");
    expect(referrerHostOf("not a host")).toBeNull();
    expect(attributionFrom({ source: "x".repeat(300) }, "pickstall.store")?.source).toHaveLength(100);
  });
});

describe("sales by source", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts this store's paid sales, net of partial refunds, without free or bump orders", async () => {
    db.orders.aggregate.mockReturnValue({ toArray: async () => [] });
    const now = new Date("2026-11-20T00:00:00Z");
    await salesBySource("store-1", "usd", 30, now);
    const pipeline = db.orders.aggregate.mock.calls[0]?.[0] as Record<string, unknown>[];
    expect(pipeline[0]).toEqual({ $match: { storeId: "store-1", status: "paid", currency: "usd", totalCents: { $gt: 0 }, paidAt: { $gte: new Date("2026-10-21T00:00:00Z") }, bumpOf: null } });
    expect(JSON.stringify(pipeline[1])).toContain("amountRefundedCents");
  });

  it("merges campaigns into one row per source, best revenue first, with the top campaign", async () => {
    db.orders.aggregate.mockReturnValue({
      toArray: async () => [
        { _id: { source: "direct", campaign: null }, orders: 5, revenueCents: 5000 },
        { _id: { source: "instagram", campaign: "launch" }, orders: 3, revenueCents: 6000 },
        { _id: { source: "instagram", campaign: "reel" }, orders: 1, revenueCents: 2000 },
      ],
    });
    expect(await salesBySource("store-1", "usd", 90)).toEqual([
      { source: "instagram", orders: 4, revenueCents: 8000, topCampaign: "launch" },
      { source: "direct", orders: 5, revenueCents: 5000, topCampaign: null },
    ]);
  });
});
