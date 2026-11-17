import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

// Images in MongoDB (D-077) on a real database: saved and read back byte for byte, bounded per
// store, and only a store's own replaced images are cleared to make room.

import { collections } from "@/lib/db/collections";
import { MEDIA_STORE_QUOTA_BYTES, mediaPath } from "@/lib/media/media";
import { mongoStorage } from "@/lib/media/storage";
import { pruneUnusedImages, readImage, saveImageUpload } from "@/lib/media/uploads";

import { seedProduct, seedStore } from "./fixtures";

const png = (size = 64) => {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (let index = 8; index < size; index += 1) bytes[index] = index % 251;
  return bytes;
};

const idOf = (url: string) => url.split("/").pop() as string;

describe("images in MongoDB", () => {
  it("saves an image and serves the same bytes and type", async () => {
    const store = await seedStore();
    const bytes = png(2048);
    const result = await saveImageUpload(store._id, "avatar", bytes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const image = await readImage(idOf(result.data.url));
    expect(image?.mime).toBe("image/png");
    expect(new Uint8Array(image?.bytes ?? [])).toEqual(bytes);
  });

  it("refuses bad keys and removes bytes", async () => {
    await expect(mongoStorage.get("../../etc/passwd")).rejects.toThrow("Invalid storage key.");
    const key = `${randomUUID()}.png`;
    await mongoStorage.put(key, png(), "store-x");
    expect(await mongoStorage.get(key)).not.toBeNull();
    await mongoStorage.remove(key);
    expect(await mongoStorage.get(key)).toBeNull();
  });

  it("clears only this store's old images that nothing uses, then keeps the quota", async () => {
    const store = await seedStore();
    const other = await seedStore();
    const { uploads, stores } = await collections();
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const save = async (storeId: string) => {
      const result = await saveImageUpload(storeId, "cover", png());
      if (!result.ok) throw new Error(result.error);
      return idOf(result.data.url);
    };
    const avatar = await save(store._id);
    const cover = await save(store._id);
    const replaced = await save(store._id);
    const fresh = await save(store._id);
    const othersOld = await save(other._id);
    await uploads.updateMany({ _id: { $in: [avatar, cover, replaced, othersOld] } }, { $set: { createdAt: old } });
    await stores.updateOne({ _id: store._id }, { $set: { avatarUrl: mediaPath(avatar) } });
    await seedProduct(store._id, { coverUrl: mediaPath(cover) });

    expect(await pruneUnusedImages(store._id)).toBe(1);
    const left = (await uploads.find({ storeId: store._id }).toArray()).map((doc) => doc._id).sort();
    expect(left).toEqual([avatar, cover, fresh].sort());
    expect(await readImage(replaced)).toBeNull();
    expect(await readImage(othersOld)).not.toBeNull();
  });

  it("refuses a new image when the store's image space is full", async () => {
    const store = await seedStore();
    const { uploads } = await collections();
    await uploads.insertOne({ _id: randomUUID(), storeId: store._id, kind: "cover", mime: "image/png", size: MEDIA_STORE_QUOTA_BYTES, key: `${randomUUID()}.png`, createdAt: new Date() });
    // The big record is in use as the store photo only if referenced; here it is young, so it is kept.
    expect(await saveImageUpload(store._id, "avatar", png())).toMatchObject({ ok: false, status: 413 });
  });
});
