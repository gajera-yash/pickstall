import { beforeEach, describe, expect, it, vi } from "vitest";

import { formData, mockSession, redirectOf, storeQueries, userId } from "./auth-mocks";

const db = vi.hoisted(() => ({
  storeFindOne: vi.fn(),
  productFind: vi.fn(),
  productFindOne: vi.fn(),
}));

vi.mock("@/lib/db/collections", () => ({
  collections: vi.fn(async () => ({
    stores: { findOne: db.storeFindOne },
    products: {
      find: db.productFind,
      findOne: db.productFindOne,
    },
  })),
}));

import { findPublicProduct, findPublicStore, listPublicProducts } from "@/lib/stores/public";
import { setStorePublishedAction } from "@/lib/stores/actions";
import { priceLabel } from "@/components/store/store-page";
import { buildChecklist } from "@/lib/dashboard/checklist";

const PRIVATE_KEYS = ["ownerId", "stripeAccountId", "stripeChargesEnabled", "isPublished", "externalUrl", "checkout", "afterPurchase", "storeId", "downloadLimit", "status"];

describe("public store reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.productFind.mockReturnValue({ sort: () => ({ limit: () => ({ toArray: async () => [] }) }) });
  });

  it("looks up published stores only, with an allow-list projection", async () => {
    db.storeFindOne.mockResolvedValue(null);
    expect(await findPublicStore("maya")).toBeNull();
    const [filter, options] = db.storeFindOne.mock.calls[0] as [Record<string, unknown>, { projection: Record<string, number> }];
    expect(filter).toEqual({ slug: "maya", isPublished: true });
    for (const key of PRIVATE_KEYS) expect(options.projection).not.toHaveProperty(key);
  });

  it("never returns private store fields even if the database row has them", async () => {
    db.storeFindOne.mockResolvedValue({
      _id: "s1",
      slug: "maya",
      name: "Maya",
      bio: null,
      avatarUrl: null,
      socialLinks: [],
      theme: { preset: "clean", accent: "#0056FF" },
      currency: "usd",
      ownerId: "owner-1",
      stripeAccountId: "acct_123",
    });
    const store = await findPublicStore("maya");
    for (const key of PRIVATE_KEYS) expect(store).not.toHaveProperty(key);
    expect(store).toMatchObject({ id: "s1", slug: "maya", name: "Maya" });
  });

  it("rejects malformed usernames without a database call", async () => {
    for (const bad of ["Ab", "a b", "../etc", "x".repeat(40), "$ne", ""]) expect(await findPublicStore(bad)).toBeNull();
    expect(db.storeFindOne).not.toHaveBeenCalled();
  });

  it("lists only published products of the store, without private fields", async () => {
    await listPublicProducts("s1");
    const [filter, options] = db.productFind.mock.calls[0] as [Record<string, unknown>, { projection: Record<string, number> }];
    expect(filter).toEqual({ storeId: "s1", status: "published" });
    for (const key of PRIVATE_KEYS) expect(options.projection).not.toHaveProperty(key);
  });

  it("finds one published product by slug and strips private fields from the result", async () => {
    db.productFindOne.mockResolvedValue({
      _id: "p1",
      slug: "playbook",
      title: "Playbook",
      description: null,
      coverUrl: null,
      pricingModel: "fixed",
      priceCents: 1900,
      minPriceCents: null,
      buttonText: null,
      externalUrl: "https://secret.example.com",
      checkout: { questions: [] },
    });
    const product = await findPublicProduct("s1", "playbook");
    expect(db.productFindOne.mock.calls[0]?.[0]).toEqual({ storeId: "s1", slug: "playbook", status: "published" });
    for (const key of PRIVATE_KEYS) expect(product).not.toHaveProperty(key);
    expect(await findPublicProduct("s1", "Bad Slug!")).toBeNull();
  });
});

describe("price label", () => {
  it.each([
    [{ pricingModel: "fixed", priceCents: 0, minPriceCents: null }, "Free"],
    [{ pricingModel: "fixed", priceCents: 1999, minPriceCents: null }, "$19.99"],
    [{ pricingModel: "pwyw", priceCents: 2000, minPriceCents: 500 }, "From $5.00"],
    [{ pricingModel: "pwyw", priceCents: 2000, minPriceCents: 0 }, "Pay what you want"],
  ] as const)("%j is %s", (product, label) => {
    expect(priceLabel(product, "usd")).toBe(label);
  });
});

describe("publish the store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession({ id: userId, email: "maya@example.com" });
    storeQueries.findStoreByOwner.mockResolvedValue({ id: "s1", slug: "maya" });
  });

  it("publishes the session owner's own store", async () => {
    storeQueries.setStorePublished.mockResolvedValue(true);
    expect(await setStorePublishedAction(true)).toEqual({ ok: true, data: { isPublished: true } });
    expect(storeQueries.setStorePublished).toHaveBeenCalledWith(userId, true);
  });

  it("sends a signed-out visitor to login and ignores non-boolean input", async () => {
    storeQueries.setStorePublished.mockResolvedValue(true);
    expect(await setStorePublishedAction("yes" as unknown as boolean)).toMatchObject({ ok: false });
    expect(storeQueries.setStorePublished).not.toHaveBeenCalled();
    mockSession(null);
    expect(await redirectOf(() => setStorePublishedAction(true))).toBe("/login?next=%2Fdashboard");
  });

  it("hides database errors", async () => {
    storeQueries.setStorePublished.mockRejectedValue(new Error("db down"));
    const result = await setStorePublishedAction(true);
    expect(JSON.stringify(result)).not.toContain("db down");
  });

  it("makes the publish step of the checklist reachable", () => {
    const { items } = buildChecklist({ bio: null, avatarUrl: null, chargesEnabled: false, isPublished: false, productCount: 0 });
    expect(items.find((item) => item.id === "publish")).toMatchObject({ available: true, done: false });
    expect(formData({}).has("x")).toBe(false);
  });
});
