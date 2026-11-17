import "server-only";

import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { Binary } from "mongodb";

import { collections } from "@/lib/db/collections";
import { serverEnv } from "@/lib/env.server";

// Storage for uploaded images (D-032, D-077). Images are kept in MongoDB, so they work on Vercel,
// whose functions cannot keep files on disk, without a paid file store. Keys are server-made
// (`<uuid>.<ext>`), never taken from a client file name, and are checked again before use.

export type FileStorage = {
  put(key: string, bytes: Uint8Array, storeId: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
};

const KEY = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;

function checkKey(key: string): string {
  if (!KEY.test(key)) throw new Error("Invalid storage key.");
  return key;
}

/** Path of an old disk image. A runtime folder, not part of the build: Turbopack must not trace it. */
function diskPath(key: string): string {
  const dir = path.resolve(/* turbopackIgnore: true */ serverEnv.UPLOAD_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "uploads"));
  return path.join(/* turbopackIgnore: true */ dir, checkKey(key));
}

/** Images saved on this server's disk before D-077 (development only). Read-only now. */
async function readFromDisk(key: string): Promise<Buffer | null> {
  try {
    return await readFile(/* turbopackIgnore: true */ diskPath(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Image bytes in the `mediaBlobs` collection. A key can be written once (unique `_id`). */
export const mongoStorage: FileStorage = {
  async put(key, bytes, storeId) {
    const { mediaBlobs } = await collections();
    await mediaBlobs.insertOne({ _id: checkKey(key), storeId, bytes: new Binary(bytes), size: bytes.byteLength, createdAt: new Date() });
  },
  async get(key) {
    const { mediaBlobs } = await collections();
    const doc = await mediaBlobs.findOne({ _id: checkKey(key) }, { projection: { bytes: 1 } });
    if (doc) return Buffer.from(doc.bytes.buffer);
    // Local images uploaded before D-077 still show in development.
    return process.env.NODE_ENV === "production" ? null : readFromDisk(key);
  },
  async remove(key) {
    const { mediaBlobs } = await collections();
    await mediaBlobs.deleteOne({ _id: checkKey(key) });
    if (process.env.NODE_ENV !== "production") await rm(/* turbopackIgnore: true */ diskPath(key), { force: true });
  },
};

export const storage: FileStorage = mongoStorage;
