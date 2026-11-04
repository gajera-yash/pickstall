import "server-only";

import { setBunnyVideoStatus } from "@/lib/courses/curriculum";
import { collections } from "@/lib/db/collections";
import { logger } from "@/lib/logger";
import { bunnyConfig, fetchVideoStatus } from "@/lib/video/bunny";

const MAX_CHECKS = 10;

/**
 * Asks Bunny about this store's course videos that are still uploading or processing, and saves
 * what it says (D-055 follow-up). The builder calls this while it waits, so videos turn "ready"
 * even where Bunny's webhook cannot reach (localhost). Failures only mean "ask again later".
 */
export async function refreshPendingVideos(storeId: string, courseId: string): Promise<void> {
  const config = bunnyConfig();
  if (!config) return;
  const { lessons } = await collections();
  const pending = await lessons
    .find({ storeId, productId: courseId, "video.kind": "bunny", "video.status": { $in: ["uploading", "processing"] } }, { projection: { video: 1 } })
    .limit(MAX_CHECKS)
    .toArray();
  for (const lesson of pending) {
    if (lesson.video?.kind !== "bunny") continue;
    try {
      const status = await fetchVideoStatus(config, lesson.video.videoId);
      if (status) await setBunnyVideoStatus(lesson.video.videoId, status);
    } catch (error) {
      logger.warn("courses.bunny_status_failed", { name: error instanceof Error ? error.name : undefined });
    }
  }
}
