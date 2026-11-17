import "server-only";

import { randomUUID } from "node:crypto";

import { collections } from "@/lib/db/collections";
import { IMAGE_TYPES, MEDIA_MAX_BYTES, MEDIA_STORE_QUOTA_BYTES, mediaPath, sniffImageType, type MediaKind } from "@/lib/media/media";
import { storage } from "@/lib/media/storage";

export type UploadResult =
  | { ok: true; data: { id: string; url: string; size: number } }
  | { ok: false; error: string; status: number };

/**
 * Saves an uploaded image for a store. The type comes from the file's own bytes, the size is
 * capped, and the stored name is a new uuid, never the client's file name. `storeId` must come
 * from the verified session.
 */
export async function saveImageUpload(storeId: string, kind: MediaKind, bytes: Uint8Array): Promise<UploadResult> {
  if (bytes.byteLength === 0) return { ok: false, error: "That file is empty.", status: 400 };
  if (bytes.byteLength > MEDIA_MAX_BYTES) return { ok: false, error: `Use an image under ${MEDIA_MAX_BYTES / 1024 / 1024} MB.`, status: 413 };

  const mime = sniffImageType(bytes);
  if (!mime) return { ok: false, error: "Use a JPG, PNG, WebP or GIF image.", status: 415 };

  const { uploads } = await collections();
  // One store's images share the database with everyone else's (D-077): keep each store bounded.
  // Replaced images are cleared first, so a creator who changes photos often does not run out.
  let used = await imageBytesOfStore(storeId);
  if (used + bytes.byteLength > MEDIA_STORE_QUOTA_BYTES) {
    await pruneUnusedImages(storeId);
    used = await imageBytesOfStore(storeId);
  }
  if (used + bytes.byteLength > MEDIA_STORE_QUOTA_BYTES) {
    return { ok: false, error: "Your store has used all of its image space. Use fewer or smaller images, or contact support.", status: 413 };
  }

  const id = randomUUID();
  const key = `${id}.${IMAGE_TYPES[mime]}`;
  await storage.put(key, bytes, storeId);

  try {
    await uploads.insertOne({ _id: id, storeId, kind, mime, size: bytes.byteLength, key, createdAt: new Date() });
  } catch (error) {
    await storage.remove(key).catch(() => undefined);
    throw error;
  }
  return { ok: true, data: { id, url: mediaPath(id), size: bytes.byteLength } };
}

/** Total size of a store's uploaded images. */
async function imageBytesOfStore(storeId: string): Promise<number> {
  const { uploads } = await collections();
  const [row] = await uploads.aggregate<{ total: number }>([{ $match: { storeId } }, { $group: { _id: null, total: { $sum: "$size" } } }]).toArray();
  return row?.total ?? 0;
}

/** Images younger than this are kept even when unused: the creator may not have pressed Save yet. */
const PRUNE_GRACE_MS = 60 * 60 * 1000;

/**
 * Deletes this store's images that nothing shows any more (a replaced store photo or cover). An
 * image is in use when it is the store's photo or any of its products' or courses' cover. Only
 * `storeId`'s own images are touched; returns how many were removed.
 */
export async function pruneUnusedImages(storeId: string, now = new Date()): Promise<number> {
  const { uploads, stores, products } = await collections();
  const [store, covers] = await Promise.all([
    stores.findOne({ _id: storeId }, { projection: { avatarUrl: 1 } }),
    products.find({ storeId, coverUrl: { $type: "string" } }, { projection: { coverUrl: 1 } }).toArray(),
  ]);
  const inUse = new Set([store?.avatarUrl, ...covers.map((product) => product.coverUrl)].filter((url): url is string => typeof url === "string"));

  const candidates = await uploads.find({ storeId, createdAt: { $lt: new Date(now.getTime() - PRUNE_GRACE_MS) } }, { projection: { key: 1 } }).toArray();
  let removed = 0;
  for (const doc of candidates) {
    if (inUse.has(mediaPath(doc._id))) continue;
    await uploads.deleteOne({ _id: doc._id, storeId });
    await storage.remove(doc.key).catch(() => undefined);
    removed += 1;
  }
  return removed;
}

/** An uploaded image for serving: its bytes and type, or null. Images are public by design (they sit on public pages). */
export async function readImage(id: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const { uploads } = await collections();
  const doc = await uploads.findOne({ _id: id }, { projection: { key: 1, mime: 1 } });
  if (!doc) return null;
  const bytes = await storage.get(doc.key);
  return bytes ? { bytes, mime: doc.mime } : null;
}
