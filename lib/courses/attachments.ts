import "server-only";

import { randomUUID } from "node:crypto";

import { PRODUCT_FILE_MAX_BYTES } from "@/lib/config";
import { COURSE_LIMITS } from "@/lib/courses/settings";
import { collections, type FileDoc } from "@/lib/db/collections";
import { removeFile, writeFileStream } from "@/lib/files/storage";
import { PRODUCT_FILE_LABELS, PRODUCT_FILE_TYPES, cleanFileName, detectFileType, type ProductFileInfo } from "@/lib/files/types";
import { logger } from "@/lib/logger";

// Lesson attachments (D-055): PDFs, source files and the like, in the same private disk storage
// and `files` collection as digital product files (D-050), marked with the lesson id. Every query
// filters by the session owner's store id and the course id.

export type SaveAttachmentResult = { ok: true; data: ProductFileInfo } | { ok: false; error: string; status: number };

/** Saves an upload as an attachment of one of this store's lessons (at most 5 per lesson). */
export async function saveLessonAttachment(storeId: string, courseId: string, lessonId: string, rawName: string, body: ReadableStream<Uint8Array>): Promise<SaveAttachmentResult> {
  const { lessons, files } = await collections();
  if ((await lessons.countDocuments({ _id: lessonId, storeId, productId: courseId }, { limit: 1 })) !== 1) return { ok: false, error: "We couldn't find that lesson.", status: 404 };
  if ((await files.countDocuments({ storeId, lessonId })) >= COURSE_LIMITS.attachmentsMax) return { ok: false, error: `A lesson can have up to ${COURSE_LIMITS.attachmentsMax} files.`, status: 409 };

  const key = randomUUID();
  const written = await writeFileStream(key, body, PRODUCT_FILE_MAX_BYTES);
  if (!written.ok) {
    return written.reason === "too_large"
      ? { ok: false, error: `Use a file under ${PRODUCT_FILE_MAX_BYTES / 1024 / 1024} MB.`, status: 413 }
      : { ok: false, error: "That file is empty.", status: 400 };
  }
  const type = detectFileType(rawName, written.head);
  if (!type) {
    await removeFile(key);
    return { ok: false, error: `Use one of these file types: ${PRODUCT_FILE_LABELS}.`, status: 415 };
  }

  const doc: FileDoc = { _id: randomUUID(), storeId, productId: courseId, lessonId, key, name: cleanFileName(rawName, type.ext), ext: type.ext, mime: type.mime, size: written.size, createdAt: new Date() };
  try {
    await files.insertOne(doc);
  } catch (error) {
    await removeFile(key).catch(() => undefined);
    throw error;
  }
  return { ok: true, data: { id: doc._id, name: doc.name, size: doc.size, label: PRODUCT_FILE_TYPES[doc.ext]?.label ?? doc.ext.toUpperCase() } };
}

/** Removes one attachment of one of this store's lessons. */
export async function removeLessonAttachment(storeId: string, courseId: string, lessonId: string, fileId: string): Promise<boolean> {
  const { files } = await collections();
  const doc = await files.findOneAndDelete({ _id: fileId, storeId, productId: courseId, lessonId });
  if (!doc) return false;
  await removeFile(doc.key).catch((error: unknown) => logger.warn("courses.attachment_remove_failed", { name: error instanceof Error ? error.name : undefined }));
  return true;
}

/** Removes every attachment of lessons that were deleted. */
export async function removeAttachmentsOfLessons(storeId: string, courseId: string, lessonIds: string[]): Promise<void> {
  if (lessonIds.length === 0) return;
  const { files } = await collections();
  const docs = await files.find({ storeId, productId: courseId, lessonId: { $in: lessonIds } }, { projection: { key: 1 } }).toArray();
  await files.deleteMany({ storeId, productId: courseId, lessonId: { $in: lessonIds } });
  for (const doc of docs) await removeFile(doc.key).catch(() => undefined);
}
