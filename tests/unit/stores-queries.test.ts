import { beforeEach, describe, expect, it, vi } from "vitest";

// Ownership tests for lib/stores/queries.ts (CLAUDE.md section 6). MongoDB has no row-level
// security, so every read and write must filter by the owner id it is given (from the session).

const hoisted = vi.hoisted(() => {
  class DuplicateKey extends Error {
    constructor(public readonly field: string) {
      super("E11000 duplicate key");
    }
  }
  const stores = { findOne: vi.fn(), updateOne: vi.fn() };
  return { stores, DuplicateKey };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => ({ stores: hoisted.stores })) }));
vi.mock("@/lib/db/mongo", () => ({
  isDuplicateKeyError: (error: unknown, field?: string) =>
    error instanceof hoisted.DuplicateKey && (field === undefined || error.field === field),
}));

import {
  changeStoreSlug,
  findStoreByOwner,
  socialLinksOf,
  updateStorePageDesign,
  updateStoreProfile,
} from "@/lib/stores/queries";

const creatorA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const { stores } = hoisted;

const profile = {
  name: "Maya's Kitchen",
  bio: undefined,
  avatarUrl: undefined,
  currency: "usd" as const,
  socialLinks: [{ kind: "x" as const, url: "https://x.com/maya" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  stores.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
});

/** The filter of the only updateOne call: it must be exactly the owner filter, nothing a client could widen. */
function updateFilter(): unknown {
  expect(stores.updateOne).toHaveBeenCalledTimes(1);
  return stores.updateOne.mock.calls[0]?.[0];
}

describe("findStoreByOwner", () => {
  it("reads only the owner's store", async () => {
    stores.findOne.mockResolvedValue(null);
    expect(await findStoreByOwner(creatorA)).toBeNull();
    expect(stores.findOne).toHaveBeenCalledWith({ ownerId: creatorA });
  });

  it("returns social links, falling back to the old single link before the migration", async () => {
    const base = { _id: "s1", ownerId: creatorA, slug: "maya", name: "Maya", bio: null, avatarUrl: null, currency: "usd" };
    const theme = { preset: "clean", accent: "#0056FF" };
    stores.findOne.mockResolvedValue({ ...base, theme, link: "https://maya.com", stripeChargesEnabled: false, isPublished: false });
    expect((await findStoreByOwner(creatorA))?.socialLinks).toEqual([{ kind: "website", url: "https://maya.com" }]);
  });
});

describe("socialLinksOf", () => {
  it("prefers socialLinks, then the old link, then nothing", () => {
    expect(socialLinksOf({ socialLinks: [], link: "https://old.com" })).toEqual([]);
    expect(socialLinksOf({ link: "https://old.com" })).toEqual([{ kind: "website", url: "https://old.com" }]);
    expect(socialLinksOf({ link: null })).toEqual([]);
  });
});

describe("updateStoreProfile", () => {
  it("writes only to the owner's store and removes the old link field", async () => {
    expect(await updateStoreProfile(creatorA, profile)).toBe(true);
    expect(updateFilter()).toEqual({ ownerId: creatorA });
    const update = stores.updateOne.mock.calls[0]?.[1] as { $set: Record<string, unknown>; $unset: Record<string, unknown> };
    expect(update.$set).toMatchObject({ name: "Maya's Kitchen", bio: null, avatarUrl: null, socialLinks: profile.socialLinks });
    expect(update.$set).not.toHaveProperty("slug");
    expect(update.$set).not.toHaveProperty("ownerId");
    expect(update.$set).not.toHaveProperty("isPublished");
    expect(update.$unset).toEqual({ link: "" });
  });

  it("reports false when the owner has no store (creator A cannot reach creator B's)", async () => {
    stores.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
    expect(await updateStoreProfile(creatorA, profile)).toBe(false);
  });
});

describe("updateStorePageDesign", () => {
  it("writes only the theme, only to the owner's store", async () => {
    expect(await updateStorePageDesign(creatorA, { themePreset: "soft", accent: "#C2410C" })).toBe(true);
    expect(updateFilter()).toEqual({ ownerId: creatorA });
    const update = stores.updateOne.mock.calls[0]?.[1] as { $set: Record<string, unknown> };
    expect(Object.keys(update.$set).sort()).toEqual(["theme", "updatedAt"]);
  });
});

describe("changeStoreSlug", () => {
  it("updates the owner's own slug in one write (no check-then-update)", async () => {
    expect(await changeStoreSlug(creatorA, "maya-cooks")).toBe("changed");
    expect(updateFilter()).toEqual({ ownerId: creatorA });
    expect(stores.findOne).not.toHaveBeenCalled();
  });

  it("returns taken when the unique index rejects the slug", async () => {
    stores.updateOne.mockRejectedValue(new hoisted.DuplicateKey("slug"));
    expect(await changeStoreSlug(creatorA, "sam")).toBe("taken");
  });

  it("returns no_store when the owner has no store", async () => {
    stores.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
    expect(await changeStoreSlug(creatorA, "maya-cooks")).toBe("no_store");
  });

  it("rethrows other database errors", async () => {
    stores.updateOne.mockRejectedValue(new Error("db down"));
    await expect(changeStoreSlug(creatorA, "maya-cooks")).rejects.toThrow("db down");
  });
});
