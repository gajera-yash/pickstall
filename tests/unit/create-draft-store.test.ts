import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  class DuplicateKey extends Error {
    constructor(public readonly field: string) {
      super("E11000 duplicate key");
    }
  }
  return { insertOne: vi.fn(), DuplicateKey };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/db/collections", () => ({
  collections: vi.fn(async () => ({ stores: { insertOne: hoisted.insertOne } })),
}));
vi.mock("@/lib/db/mongo", () => ({
  isDuplicateKeyError: (error: unknown, field?: string) =>
    error instanceof hoisted.DuplicateKey && (field === undefined || error.field === field),
}));

import { createDraftStore } from "@/lib/stores/create-draft-store";

const ownerId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createDraftStore", () => {
  it("inserts an unpublished store named after the username, with USD and the default theme", async () => {
    hoisted.insertOne.mockResolvedValue({ acknowledged: true });
    expect(await createDraftStore(ownerId, "maya-books", "M.aya+shop@Gmail.com")).toBe("created");
    expect(hoisted.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId,
        ownerEmailKey: "maya@gmail.com",
        slug: "maya-books",
        name: "Maya Books",
        currency: "usd",
        theme: { preset: "clean", accent: "#0056FF" },
        isPublished: false,
        stripeAccountId: null,
        stripeChargesEnabled: false,
      }),
    );
    const doc = hoisted.insertOne.mock.calls[0]?.[0] as { _id: string };
    expect(doc._id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("maps unique-index violations to taken, has_store or email_used", async () => {
    hoisted.insertOne.mockRejectedValueOnce(new hoisted.DuplicateKey("slug"));
    expect(await createDraftStore(ownerId, "maya", "maya@gmail.com")).toBe("taken");
    hoisted.insertOne.mockRejectedValueOnce(new hoisted.DuplicateKey("ownerId"));
    expect(await createDraftStore(ownerId, "maya", "maya@gmail.com")).toBe("has_store");
    hoisted.insertOne.mockRejectedValueOnce(new hoisted.DuplicateKey("ownerEmailKey"));
    expect(await createDraftStore(ownerId, "maya", "maya@gmail.com")).toBe("email_used");
  });

  it("returns error for anything else", async () => {
    hoisted.insertOne.mockRejectedValueOnce(new Error("network"));
    expect(await createDraftStore(ownerId, "maya", "maya@gmail.com")).toBe("error");
  });
});
