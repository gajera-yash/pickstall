import "server-only";

import { removeCurriculumOf } from "@/lib/courses/curriculum";
import { logger } from "@/lib/logger";
import { bunnyConfig, deleteVideo } from "@/lib/video/bunny";

/**
 * After a course is deleted: removes its modules and lessons and deletes its Bunny videos (D-055).
 * Its attachments go with the product's files. A Bunny failure only leaves a video in the library.
 */
export async function removeCourseContent(storeId: string, courseId: string): Promise<void> {
  const videoIds = await removeCurriculumOf(storeId, courseId);
  const config = bunnyConfig();
  if (!config) return;
  for (const videoId of videoIds) {
    await deleteVideo(config, videoId).catch((error: unknown) => logger.warn("courses.bunny_delete_failed", { name: error instanceof Error ? error.name : undefined }));
  }
}
