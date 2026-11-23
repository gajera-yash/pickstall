import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

// D-119 on a real MongoDB: the signup source saved on a new store, and the first publish date.

import { collections } from "@/lib/db/collections";
import { createDraftStore } from "@/lib/stores/create-draft-store";
import { setStorePublished } from "@/lib/stores/queries";

import { seedStore } from "./fixtures";

describe("signup source and first publish", () => {
  it("saves the acquisition on a new store, and nothing for a direct signup", async () => {
    const owner = randomUUID();
    const acquisition = { ref: "lead-1", source: "outreach", medium: "dm", campaign: null, referrer: null };
    expect(await createDraftStore(owner, `m${randomUUID().slice(0, 8)}`, `${randomUUID()}@example.com`, acquisition)).toBe("created");
    const direct = randomUUID();
    expect(await createDraftStore(direct, `m${randomUUID().slice(0, 8)}`, `${randomUUID()}@example.com`)).toBe("created");
    const { stores } = await collections();
    expect((await stores.findOne({ ownerId: owner }))?.acquisition).toEqual(acquisition);
    expect((await stores.findOne({ ownerId: direct }))?.acquisition).toBeUndefined();
  });

  it("sets publishedAt on the first publish only", async () => {
    const store = await seedStore({ isPublished: false });
    const { stores } = await collections();
    expect(await setStorePublished(store.ownerId, true)).toBe(true);
    const first = (await stores.findOne({ _id: store._id }))?.publishedAt;
    expect(first).toBeInstanceOf(Date);
    await setStorePublished(store.ownerId, false);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await setStorePublished(store.ownerId, true);
    const after = await stores.findOne({ _id: store._id });
    expect(after?.isPublished).toBe(true);
    expect(after?.publishedAt?.getTime()).toBe(first?.getTime());
    expect(await setStorePublished(randomUUID(), true)).toBe(false);
  });
});
