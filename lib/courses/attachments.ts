import "server-only";

import { collections } from "@/lib/db/collections";
import { removeStoredFile } from "@/lib/files/storage";
import { logger } from "@/lib/logger";

// Lesson attachments (D-055): PDFs, source files and the like, in the same private storage and
// `files` collection as digital product files (D-050), marked with the lesson id. Uploads go
// through lib/files/uploads.ts (D-093). Every query filters by the session owner's store id and
// the course id.

/** Removes one attachment of one of this store's lessons. */
export async function removeLessonAttachment(storeId: string, courseId: string, lessonId: string, fileId: string): Promise<boolean> {
  const { files } = await collections();
  const doc = await files.findOneAndDelete({ _id: fileId, storeId, productId: courseId, lessonId });
  if (!doc) return false;
  await removeStoredFile(doc.storage, doc.key).catch((error: unknown) => logger.warn("courses.attachment_remove_failed", { name: error instanceof Error ? error.name : undefined }));
  return true;
}

/** Removes every attachment of lessons that were deleted. */
export async function removeAttachmentsOfLessons(storeId: string, courseId: string, lessonIds: string[]): Promise<void> {
  if (lessonIds.length === 0) return;
  const { files } = await collections();
  const docs = await files.find({ storeId, productId: courseId, lessonId: { $in: lessonIds } }, { projection: { key: 1, storage: 1 } }).toArray();
  await files.deleteMany({ storeId, productId: courseId, lessonId: { $in: lessonIds } });
  for (const doc of docs) await removeStoredFile(doc.storage, doc.key).catch(() => undefined);
}
