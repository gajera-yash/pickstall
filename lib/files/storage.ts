import "server-only";

import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { serverEnv } from "@/lib/env.server";
import { inspectR2Object, r2Configured, removeR2Object } from "@/lib/files/r2";
import { FILE_HEAD_BYTES } from "@/lib/files/types";

// Private storage for product files (D-050): a folder on this server's disk, separate from the
// public images. Nothing here is ever served by path; a file leaves only through the buyer
// library after the order checks. Keys are server-made uuids, checked before any path is built.
// On the live site files go to the private R2 bucket instead (D-093, ./r2.ts).

const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function filesDir(): string {
  // A runtime folder, not part of the build: tell Turbopack not to trace it.
  return path.resolve(/* turbopackIgnore: true */ serverEnv.PRODUCT_FILES_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "product-files"));
}

function pathFor(key: string): string {
  if (!KEY.test(key)) throw new Error("Invalid file key.");
  return path.join(filesDir(), key);
}

/** Where a file's bytes live: the private R2 bucket (D-093) or this server's disk (D-050). */
export type StorageKind = "r2" | "disk";

/**
 * Where new uploads go: R2 when it is configured; otherwise the disk folder, which only lasts in
 * development or on an own server with PRODUCT_FILES_DIR (D-077). Null: uploads are off.
 */
export function activeStorage(): StorageKind | null {
  if (r2Configured()) return "r2";
  if (process.env.NODE_ENV !== "production" || serverEnv.PRODUCT_FILES_DIR) return "disk";
  return null;
}

/** Whether product and lesson files can be uploaded on this server. */
export function fileStorageAvailable(): boolean {
  return activeStorage() !== null;
}

export const FILE_UPLOADS_OFF_MESSAGE = "File uploads aren't available on the live site yet. For now, share the file with a link (Google Drive, Dropbox or Notion).";

export type WriteResult = { ok: true; size: number; head: Uint8Array } | { ok: false; reason: "empty" | "too_large" };

/**
 * Streams an upload to disk under `key`, never holding it in memory. Stops and deletes the partial
 * file once it passes `maxBytes`. Returns the size and the first bytes for the type check; the
 * file only appears under its key when it is complete.
 */
export async function writeFileStream(key: string, body: ReadableStream<Uint8Array>, maxBytes: number): Promise<WriteResult> {
  const target = pathFor(key);
  const partial = `${target}.part`;
  await mkdir(path.dirname(target), { recursive: true });

  const out = createWriteStream(partial, { flags: "wx" });
  const head = new Uint8Array(FILE_HEAD_BYTES);
  let headLength = 0;
  let size = 0;
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        out.destroy();
        await rm(partial, { force: true });
        return { ok: false, reason: "too_large" };
      }
      if (headLength < FILE_HEAD_BYTES) {
        const take = value.subarray(0, FILE_HEAD_BYTES - headLength);
        head.set(take, headLength);
        headLength += take.byteLength;
      }
      if (!out.write(value)) await new Promise<void>((resolve) => out.once("drain", resolve));
    }
    await new Promise<void>((resolve, reject) => out.end((error?: Error | null) => (error ? reject(error) : resolve())));
  } catch (error) {
    out.destroy();
    await rm(partial, { force: true });
    throw error;
  }

  if (size === 0) {
    await rm(partial, { force: true });
    return { ok: false, reason: "empty" };
  }
  await rename(partial, target);
  return { ok: true, size, head: head.subarray(0, headLength) };
}

/** A stored file as a stream for a download, or null when it is missing. */
export async function readFileStream(key: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null> {
  const file = pathFor(key);
  try {
    const info = await stat(file);
    if (!info.isFile()) return null;
    return { stream: Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>, size: info.size };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function removeFile(key: string): Promise<void> {
  await rm(pathFor(key), { force: true });
}

/** A stored file's size and first bytes (for the type check), or null when it is missing. */
export async function inspectStoredFile(storage: StorageKind, key: string): Promise<{ size: number; head: Uint8Array } | null> {
  if (!KEY.test(key)) throw new Error("Invalid file key.");
  if (storage === "r2") return inspectR2Object(key, FILE_HEAD_BYTES);
  let handle;
  try {
    handle = await open(pathFor(key), "r");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  try {
    const { size } = await handle.stat();
    const head = new Uint8Array(FILE_HEAD_BYTES);
    const { bytesRead } = await handle.read(head, 0, FILE_HEAD_BYTES, 0);
    return { size, head: head.subarray(0, bytesRead) };
  } finally {
    await handle.close();
  }
}

/** Deletes a stored file wherever it lives. Missing files are fine. */
export async function removeStoredFile(storage: StorageKind | undefined, key: string): Promise<void> {
  if (storage === "r2") {
    if (!KEY.test(key)) throw new Error("Invalid file key.");
    await removeR2Object(key);
    return;
  }
  await removeFile(key);
}
