import "server-only";

import { randomUUID } from "node:crypto";

import { collections } from "@/lib/db/collections";
import { IMAGE_TYPES, MEDIA_MAX_BYTES, mediaPath, sniffImageType, type MediaKind } from "@/lib/media/media";
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

  const id = randomUUID();
  const key = `${id}.${IMAGE_TYPES[mime]}`;
  await storage.put(key, bytes);

  const { uploads } = await collections();
  try {
    await uploads.insertOne({ _id: id, storeId, kind, mime, size: bytes.byteLength, key, createdAt: new Date() });
  } catch (error) {
    await storage.remove(key).catch(() => undefined);
    throw error;
  }
  return { ok: true, data: { id, url: mediaPath(id), size: bytes.byteLength } };
}

/** An uploaded image for serving: its bytes and type, or null. Images are public by design (they sit on public pages). */
export async function readImage(id: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const { uploads } = await collections();
  const doc = await uploads.findOne({ _id: id }, { projection: { key: 1, mime: 1 } });
  if (!doc) return null;
  const bytes = await storage.get(doc.key);
  return bytes ? { bytes, mime: doc.mime } : null;
}
