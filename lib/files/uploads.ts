import "server-only";

import { randomUUID } from "node:crypto";

import { PRODUCT_FILE_MAX_BYTES } from "@/lib/config";
import { COURSE_LIMITS } from "@/lib/courses/settings";
import { collections, type FileDoc } from "@/lib/db/collections";
import { r2UploadUrl } from "@/lib/files/r2";
import { FILE_UPLOADS_OFF_MESSAGE, activeStorage, inspectStoredFile, removeStoredFile, writeFileStream } from "@/lib/files/storage";
import { PRODUCT_FILE_LABELS, PRODUCT_FILE_TYPES, cleanFileName, detectFileType, extensionOf, type ProductFileInfo } from "@/lib/files/types";
import { logger } from "@/lib/logger";

// File uploads in three steps (D-093), so a file never passes through this server on the live
// site (Vercel refuses request bodies over ~4.5 MB):
//   1. startFileUpload: checks the name, size and target, saves a "pending" file record and
//      returns where the browser sends the bytes (a signed R2 link, or our own disk route).
//   2. The browser uploads the bytes there.
//   3. finishFileUpload: reads the stored size and first bytes, checks the type against the name,
//      and only then marks the file ready and attaches it. Anything wrong deletes the bytes.
// Every query filters by the store id from the verified session (CLAUDE.md 6).

/** What a file is for: a digital product's file (D-050) or a lesson attachment (D-055). */
export type UploadTarget = { kind: "product"; productId: string } | { kind: "lesson"; courseId: string; lessonId: string };

export type StartedUpload = { fileId: string; url: string; headers: Record<string, string> };

type Fail = { ok: false; error: string; status: number };
export type UploadResult<T> = { ok: true; data: T } | Fail;

const fail = (error: string, status: number): Fail => ({ ok: false, error, status });
const TOO_LARGE = `Use a file under ${PRODUCT_FILE_MAX_BYTES / 1024 / 1024} MB.`;
const BAD_TYPE = `Use one of these file types: ${PRODUCT_FILE_LABELS}.`;

/** How long an unfinished upload is kept before the clean-up deletes it. */
export const PENDING_UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const toFileInfo = (doc: Pick<FileDoc, "_id" | "name" | "size" | "ext">): ProductFileInfo => ({
  id: doc._id,
  name: doc.name,
  size: doc.size,
  label: PRODUCT_FILE_TYPES[doc.ext]?.label ?? doc.ext.toUpperCase(),
});

/** Ready files of a lesson, for the 5-file limit. Files saved before D-093 have no status. */
async function readyLessonFiles(storeId: string, lessonId: string): Promise<number> {
  const { files } = await collections();
  return files.countDocuments({ storeId, lessonId, status: { $ne: "pending" } });
}

/** Whether the target still belongs to this store (and the lesson still has room). */
async function checkTarget(storeId: string, target: UploadTarget): Promise<Fail | null> {
  const { products, lessons } = await collections();
  if (target.kind === "product") {
    // Only digital products deliver a file; courses use lesson files, calls deliver a booking.
    const found = await products.countDocuments({ _id: target.productId, storeId, type: { $nin: ["course", "coaching"] } }, { limit: 1 });
    return found === 1 ? null : fail("We couldn't find that product.", 404);
  }
  if ((await lessons.countDocuments({ _id: target.lessonId, storeId, productId: target.courseId }, { limit: 1 })) !== 1) return fail("We couldn't find that lesson.", 404);
  if ((await readyLessonFiles(storeId, target.lessonId)) >= COURSE_LIMITS.attachmentsMax) return fail(`A lesson can have up to ${COURSE_LIMITS.attachmentsMax} files.`, 409);
  return null;
}

/** Step 1: a pending file record and where the browser sends the bytes. */
export async function startFileUpload(storeId: string, target: UploadTarget, rawName: string, size: number): Promise<UploadResult<StartedUpload>> {
  const storage = activeStorage();
  if (!storage) return fail(FILE_UPLOADS_OFF_MESSAGE, 503);
  if (!Number.isSafeInteger(size) || size <= 0) return fail("That file is empty.", 400);
  if (size > PRODUCT_FILE_MAX_BYTES) return fail(TOO_LARGE, 413);
  const ext = extensionOf(rawName);
  const kind = PRODUCT_FILE_TYPES[ext];
  if (!kind) return fail(BAD_TYPE, 415);

  const problem = await checkTarget(storeId, target);
  if (problem) return problem;

  const doc: FileDoc = {
    _id: randomUUID(),
    storeId,
    productId: target.kind === "product" ? target.productId : target.courseId,
    ...(target.kind === "lesson" ? { lessonId: target.lessonId } : {}),
    key: randomUUID(),
    name: cleanFileName(rawName, ext),
    ext,
    mime: kind.mime,
    size,
    storage,
    status: "pending",
    createdAt: new Date(),
  };
  const { files } = await collections();
  await files.insertOne(doc);

  const url = storage === "r2" ? await r2UploadUrl(doc.key, doc.mime) : `/api/files/${doc._id}`;
  return { ok: true, data: { fileId: doc._id, url, headers: { "Content-Type": doc.mime } } };
}

/**
 * Step 2 for disk storage only (development, or an own server): streams the bytes of a pending
 * upload of this store to the disk. On R2 the browser uploads to the signed link instead.
 */
export async function writePendingUpload(storeId: string, fileId: string, body: ReadableStream<Uint8Array>): Promise<UploadResult<null>> {
  const { files } = await collections();
  const doc = await files.findOne({ _id: fileId, storeId, storage: "disk", status: "pending" }, { projection: { key: 1 } });
  if (!doc) return fail("We couldn't find that upload. Try again.", 404);
  const written = await writeFileStream(doc.key, body, PRODUCT_FILE_MAX_BYTES);
  if (!written.ok) return written.reason === "too_large" ? fail(TOO_LARGE, 413) : fail("That file is empty.", 400);
  return { ok: true, data: null };
}

/** Deletes a file record and then its bytes (bytes last: never a record without a file). */
async function discard(doc: Pick<FileDoc, "_id" | "key" | "storeId" | "storage">): Promise<void> {
  const { files } = await collections();
  await files.deleteOne({ _id: doc._id, storeId: doc.storeId });
  await removeStoredFile(doc.storage, doc.key).catch((error: unknown) => logger.warn("files.remove_failed", { name: error instanceof Error ? error.name : undefined }));
}

/** Step 3: checks the uploaded bytes, then marks the file ready and attaches it. */
export async function finishFileUpload(storeId: string, fileId: string): Promise<UploadResult<ProductFileInfo>> {
  const { files, products } = await collections();
  const doc = await files.findOne({ _id: fileId, storeId, status: "pending" });
  if (!doc) return fail("We couldn't find that upload. Try again.", 404);

  const stored = await inspectStoredFile(doc.storage ?? "disk", doc.key);
  if (!stored) return fail("The file didn't arrive. Try the upload again.", 400);
  if (stored.size > PRODUCT_FILE_MAX_BYTES) return (await discard(doc), fail(TOO_LARGE, 413));
  if (stored.size === 0) return (await discard(doc), fail("That file is empty.", 400));
  // The name was cleaned with an allowed extension in step 1; the bytes must match that type.
  if (!detectFileType(doc.name, stored.head)) return (await discard(doc), fail(BAD_TYPE, 415));

  const target: UploadTarget = doc.lessonId ? { kind: "lesson", courseId: doc.productId, lessonId: doc.lessonId } : { kind: "product", productId: doc.productId };
  const problem = await checkTarget(storeId, target);
  if (problem) return (await discard(doc), problem);

  const marked = await files.updateOne({ _id: fileId, storeId, status: "pending" }, { $set: { status: "ready", size: stored.size } });
  if (marked.modifiedCount !== 1) return fail("We couldn't find that upload. Try again.", 404);
  const ready = { ...doc, size: stored.size };

  if (target.kind === "product") {
    const before = await products.findOneAndUpdate({ _id: target.productId, storeId }, { $set: { fileId, deliveryType: "file", updatedAt: new Date() } }, { projection: { fileId: 1 } });
    if (!before) return (await discard(ready), fail("We couldn't find that product.", 404));
    if (before.fileId && before.fileId !== fileId) {
      const old = await files.findOne({ _id: before.fileId, storeId }, { projection: { key: 1, storeId: 1, storage: 1 } });
      if (old) await discard(old);
    }
  }
  return { ok: true, data: toFileInfo(ready) };
}

/**
 * Deletes uploads that never finished (older than a day), across all stores. Run by a scheduled
 * job; returns how many were removed.
 */
export async function cleanupPendingUploads(now: Date, batch = 200): Promise<number> {
  const { files } = await collections();
  const stale = await files
    .find({ status: "pending", createdAt: { $lt: new Date(now.getTime() - PENDING_UPLOAD_MAX_AGE_MS) } }, { projection: { key: 1, storeId: 1, storage: 1 } })
    .limit(batch)
    .toArray();
  for (const doc of stale) await discard(doc);
  return stale.length;
}

