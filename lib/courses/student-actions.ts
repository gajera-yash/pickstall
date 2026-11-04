"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guards";
import { buildOutline, loadPlayerCourse } from "@/lib/courses/player";
import { courseAccess, completedLessons, setLessonComplete } from "@/lib/courses/student";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

// "Mark as complete" for students (D-057). The order must give this session's email access to the
// course now, and the lesson must be an open lesson of that course; nothing comes from the client
// but the two ids.

const ACCESS_ERRORS: Record<string, string> = {
  refunded: "This purchase was refunded, so access has been removed.",
  expired: "Your access to this course has ended.",
};

export async function markLessonComplete(orderId: string, lessonId: string, done: boolean): Promise<Result<{ completed: string[] }>> {
  const user = await requireUser(`/library/${orderId}/learn`);
  if (!user.email || !isUuid(orderId) || !isUuid(lessonId) || typeof done !== "boolean") return err("We couldn't find that lesson.");
  if (!(await takeRateLimit(rateLimitKey("lesson-progress:user", user.id), 120, 10))) return err("Slow down a little, then try again.");

  try {
    const now = new Date();
    const access = await courseAccess(user.email, orderId, now);
    if (!access.ok) return err(ACCESS_ERRORS[access.reason] ?? "We couldn't find that course.");
    const course = await loadPlayerCourse(access.storeId, access.courseId);
    if (!course) return err("We couldn't find that course.");
    const lesson = buildOutline(course, access.enrolledAt, now).modules.flatMap((item) => item.lessons).find((entry) => entry.id === lessonId);
    if (!lesson || lesson.locked) return err("This lesson isn't open yet.");

    await setLessonComplete(access, lessonId, done);
    revalidatePath(`/library/${orderId}/learn`);
    return ok({ completed: await completedLessons(orderId) });
  } catch (error) {
    logger.error("courses.progress_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save. Check your connection and try again.");
  }
}
