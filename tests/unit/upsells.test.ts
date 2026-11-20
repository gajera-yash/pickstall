import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  orders: { findOne: vi.fn(), countDocuments: vi.fn(), aggregate: vi.fn() },
  products: { findOne: vi.fn(), countDocuments: vi.fn(), updateOne: vi.fn(), find: vi.fn() },
  stores: { findOne: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));

import { findUpsellOffer, funnelStats, saveProductUpsell } from "@/lib/upsells/queries";
import { upsellInputFor, upsellWindowOpen } from "@/lib/upsells/rules";

const NOW = new Date("2026-11-19T12:00:00Z");
const TARGET = "22222222-2222-4222-8222-222222222222";
const order = { _id: "order-1", productId: "p1", buyerEmail: "asha@example.com", buyerName: "Asha", buyerPhone: null, paidAt: new Date("2026-11-19T11:30:00Z") };
const founding = { planTier: "founding", foundingEndsAt: new Date("2027-01-01"), trialEndsAt: null, billing: null };

describe("upsell rules (D-099)", () => {
  it("validates the product, allows a free gift and cleans the headline", () => {
    expect(upsellInputFor("usd").parse({ enabled: true, productId: TARGET, price: "19", headline: "<b>Wait!</b>  Add it" })).toEqual({ productId: TARGET, priceCents: 1900, headline: "Wait! Add it" });
    expect(upsellInputFor("usd").parse({ enabled: true, productId: TARGET, price: "0", headline: "" })).toEqual({ productId: TARGET, priceCents: 0, headline: null });
    expect(upsellInputFor("usd").parse({ enabled: false, productId: "", price: "", headline: "" })).toBeNull();
    expect(upsellInputFor("usd").safeParse({ enabled: true, productId: "", price: "19", headline: "" }).success).toBe(false);
  });

  it("is open for two hours after the purchase", () => {
    expect(upsellWindowOpen(new Date("2026-11-19T10:00:00Z"), NOW)).toBe(true);
    expect(upsellWindowOpen(new Date("2026-11-19T09:59:00Z"), NOW)).toBe(false);
    expect(upsellWindowOpen(null, NOW)).toBe(false);
  });
});

describe("the offer on the thank-you page (D-099)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.orders.findOne.mockResolvedValue(order);
    db.stores.findOne.mockResolvedValue(founding);
    db.products.findOne.mockResolvedValueOnce({ upsell: { productId: TARGET, priceCents: 1900, headline: "Add it" } }).mockResolvedValueOnce({ _id: TARGET, slug: "advanced", title: "Advanced", coverUrl: null, type: "course", priceCents: 4900, salePriceCents: null });
    db.orders.countDocuments.mockResolvedValue(0);
  });

  it("offers the saved product at the saved price, with the buyer from the paid order", async () => {
    expect(await findUpsellOffer("store-a", "order-1", NOW)).toMatchObject({ productId: TARGET, slug: "advanced", priceCents: 1900, regularCents: 4900, headline: "Add it", buyer: { email: "asha@example.com", name: "Asha" } });
    expect(db.orders.findOne).toHaveBeenCalledWith({ _id: "order-1", storeId: "store-a", status: "paid" }, expect.anything());
    expect(db.products.findOne).toHaveBeenLastCalledWith({ _id: TARGET, storeId: "store-a", status: "published", type: { $in: ["digital", "course"] }, deletedAt: { $in: [null] } }, expect.anything());
  });

  it("offers nothing for an unpaid, old, bump or upsell order", async () => {
    db.orders.findOne.mockResolvedValue(null);
    expect(await findUpsellOffer("store-a", "order-1", NOW)).toBeNull();
    db.orders.findOne.mockResolvedValue({ ...order, paidAt: new Date("2026-11-19T08:00:00Z") });
    expect(await findUpsellOffer("store-a", "order-1", NOW)).toBeNull();
    db.orders.findOne.mockResolvedValue({ ...order, upsellOf: "order-0" });
    expect(await findUpsellOffer("store-a", "order-1", NOW)).toBeNull();
    db.orders.findOne.mockResolvedValue({ ...order, bumpOf: "order-0" });
    expect(await findUpsellOffer("store-a", "order-1", NOW)).toBeNull();
  });

  it("offers nothing to a buyer who already owns it", async () => {
    // First: no offer taken yet for this order; then: the buyer owns the product.
    db.orders.countDocuments.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    expect(await findUpsellOffer("store-a", "order-1", NOW)).toBeNull();
    expect(db.orders.countDocuments).toHaveBeenCalledWith({ storeId: "store-a", productId: TARGET, buyerEmail: "asha@example.com", status: "paid" }, { limit: 1 });
  });

  it("offers nothing on a plan without upsells", async () => {
    db.stores.findOne.mockResolvedValue({ planTier: "standard", foundingEndsAt: null, trialEndsAt: null, billing: { plan: "starter", status: "active", currentPeriodEnd: new Date("2026-12-19"), cancelAtPeriodEnd: false } });
    expect(await findUpsellOffer("store-a", "order-1", NOW)).toBeNull();
  });
});

describe("saving an upsell is scoped to the session's store (CLAUDE.md 6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only names another upsell-type product of the same store", async () => {
    expect(await saveProductUpsell("store-a", TARGET, { productId: TARGET, priceCents: 100, headline: null })).toBe("bad_product");
    db.products.countDocuments.mockResolvedValue(0);
    expect(await saveProductUpsell("store-b", "p1", { productId: TARGET, priceCents: 100, headline: null })).toBe("bad_product");
    expect(db.products.countDocuments).toHaveBeenCalledWith({ _id: TARGET, storeId: "store-b", type: { $in: ["digital", "course"] }, deletedAt: { $in: [null] } });
    db.products.countDocuments.mockResolvedValue(1);
    db.products.updateOne.mockResolvedValue({ matchedCount: 0 });
    expect(await saveProductUpsell("store-b", "p1", { productId: TARGET, priceCents: 100, headline: null })).toBe("not_found");
    expect(db.products.updateOne).toHaveBeenCalledWith({ _id: "p1", storeId: "store-b", deletedAt: { $in: [null] } }, { $set: expect.objectContaining({ upsell: { productId: TARGET, priceCents: 100, headline: null } }) });
  });
});

describe("the downsell (D-115)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Earlier tests may leave queued one-time answers behind.
    db.products.findOne.mockReset();
    db.orders.countDocuments.mockReset();
    db.orders.findOne.mockResolvedValue(order);
    db.stores.findOne.mockResolvedValue(founding);
    db.orders.countDocuments.mockResolvedValue(0);
  });

  it("reads the product's downsell, at its own price", async () => {
    db.products.findOne.mockResolvedValueOnce({ downsell: { productId: TARGET, priceCents: 900, headline: "Starter instead" } }).mockResolvedValueOnce({ _id: TARGET, slug: "starter", title: "Starter", coverUrl: null, type: "digital", priceCents: 2900, salePriceCents: null });
    expect(await findUpsellOffer("store-a", "order-1", NOW, "downsell")).toMatchObject({ productId: TARGET, priceCents: 900, headline: "Starter instead" });
    expect(db.products.findOne.mock.calls[0]?.[1]).toEqual({ projection: { downsell: 1 } });
  });

  it("offers nothing more once an upsell or downsell of the order is paid", async () => {
    db.products.findOne.mockResolvedValueOnce({ downsell: { productId: TARGET, priceCents: 900, headline: null } });
    db.orders.countDocuments.mockResolvedValueOnce(1);
    expect(await findUpsellOffer("store-a", "order-1", NOW, "downsell")).toBeNull();
    expect(db.orders.countDocuments).toHaveBeenCalledWith({ storeId: "store-a", upsellOf: "order-1", status: "paid" }, { limit: 1 });
  });

  it("is saved in its own field, scoped to the store", async () => {
    db.products.countDocuments.mockResolvedValue(1);
    db.products.updateOne.mockResolvedValue({ matchedCount: 1 });
    expect(await saveProductUpsell("store-a", "p1", { productId: TARGET, priceCents: 900, headline: null }, "downsell")).toBe("saved");
    expect(db.products.updateOne).toHaveBeenCalledWith({ _id: "p1", storeId: "store-a", deletedAt: { $in: [null] } }, { $set: expect.objectContaining({ downsell: { productId: TARGET, priceCents: 900, headline: null } }) });
  });
});

describe("funnel stats (D-115)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts paid sales and the upsells and downsells bought after them, per product of this store", async () => {
    db.products.find.mockReturnValueOnce({ toArray: async () => [{ _id: "p1", title: "Playbook" }] });
    db.orders.aggregate
      .mockReturnValueOnce({ toArray: async () => [{ _id: "p1", sales: 10, salesCents: 19000 }, { _id: "p2", sales: 3, salesCents: 3000 }] })
      .mockReturnValueOnce({
        toArray: async () => [
          { _id: { productId: "p1", offer: "upsell" }, count: 2, cents: 3800 },
          { _id: { productId: "p1", offer: "downsell" }, count: 1, cents: 900 },
        ],
      });
    expect(await funnelStats("store-a", "usd", 30, NOW)).toEqual([{ productId: "p1", title: "Playbook", sales: 10, salesCents: 19000, upsells: 2, upsellCents: 3800, downsells: 1, downsellCents: 900 }]);
    const [mainPipeline, offerPipeline] = db.orders.aggregate.mock.calls.map((call) => call[0] as Record<string, unknown>[]);
    expect(mainPipeline?.[0]).toEqual({ $match: { storeId: "store-a", status: "paid", currency: "usd", paidAt: { $gte: new Date("2026-10-20T12:00:00Z") }, bumpOf: null, upsellOf: null } });
    expect(JSON.stringify(offerPipeline)).toContain('"storeId":"store-a"');
    expect(db.products.find.mock.calls[0]?.[0]).toMatchObject({ storeId: "store-a" });
  });
});
