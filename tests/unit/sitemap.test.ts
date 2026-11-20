import { describe, expect, it, vi } from "vitest";

// The sitemap lists only live stores and their published products, with public fields only.

const db = vi.hoisted(() => {
  const cursor = (rows: unknown[]) => ({ sort: () => ({ limit: () => ({ toArray: async () => rows }) }), limit: () => ({ toArray: async () => rows }) });
  return { cursor, stores: { find: vi.fn() }, products: { find: vi.fn() } };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));

import { sitemapStores } from "@/lib/stores/sitemap";

describe("sitemap stores", () => {
  it("reads published, not suspended stores and their published products", async () => {
    const at = new Date("2026-11-20T00:00:00Z");
    db.stores.find.mockReturnValue(db.cursor([{ _id: "s1", slug: "maya", updatedAt: at }, { _id: "s2", slug: "ava" }]));
    db.products.find.mockReturnValue(db.cursor([{ storeId: "s1", slug: "guide", updatedAt: at }]));

    const result = await sitemapStores();
    expect(db.stores.find.mock.calls[0]?.[0]).toEqual({ isPublished: true, suspendedAt: { $in: [null] }, deletedAt: { $exists: false } });
    expect(db.stores.find.mock.calls[0]?.[1]).toEqual({ projection: { slug: 1, updatedAt: 1 } });
    expect(db.products.find.mock.calls[0]?.[0]).toEqual({ storeId: { $in: ["s1", "s2"] }, status: "published", deletedAt: { $in: [null] } });
    expect(result).toEqual([
      { slug: "maya", updatedAt: at, products: [{ slug: "guide", updatedAt: at }] },
      { slug: "ava", updatedAt: null, products: [] },
    ]);
  });
});
