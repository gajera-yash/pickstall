"use server";

import { z } from "zod";

import { requireCreator } from "@/lib/auth/guards";
import { COURSE_EDIT_RATE_LIMIT, COURSE_VIDEO_UPLOAD_RATE_LIMIT } from "@/lib/config";
import { removeAttachmentsOfLessons, removeLessonAttachment } from "@/lib/courses/attachments";
import {
  addLesson,
  addModule,
  deleteLesson,
  deleteModule,
  loadCurriculum,
  renameModule,
  saveLayout,
  setLessonUpload,
  updateLesson,
  type CurriculumWrite,
} from "@/lib/courses/curriculum";
import type { Curriculum } from "@/lib/courses/curriculum-types";
import { COURSE_LIMITS } from "@/lib/courses/settings";
import { refreshPendingVideos } from "@/lib/courses/video-status";
import { parseVideoLink } from "@/lib/courses/video-links";
import { logger } from "@/lib/logger";
import { richDocSchemaWith, isEmptyDoc } from "@/lib/products/rich-text";
import { text } from "@/lib/products/schemas";
import { videoHoursProblem, type StoreAccess } from "@/lib/plans/access";
import { videoSecondsUsed } from "@/lib/plans/usage";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import { httpsUrlSchema } from "@/lib/stores/schemas";
import { BUNNY_TUS_ENDPOINT, bunnyConfig, createVideo, deleteVideo, uploadSignature } from "@/lib/video/bunny";

// Curriculum builder actions (D-055). Each one finds the course with the session owner's store id,
// checks every input, and answers with the whole curriculum as it now is, so the editor always
// shows what the database holds.

export type CurriculumResult = Result<Curriculum>;

const id = z.uuid();
const NOT_FOUND = "We couldn't find that course or lesson. Reload the page and try again.";
const FAILED = "Couldn't save. Check your connection and try again.";
const SLOW = "Slow down a little, then try again.";

const moduleTitle = text(COURSE_LIMITS.moduleTitle, "Module title").refine((value) => value !== undefined, { error: "Give the module a title." });
const lessonTitle = text(COURSE_LIMITS.lessonTitle, "Lesson title").refine((value) => value !== undefined, { error: "Give the lesson a title." });

function errorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

async function session(courseId: string): Promise<{ storeId: string; ownerId: string; access: StoreAccess } | null> {
  const { user, store } = await requireCreator(`/dashboard/products/${courseId}`);
  if (!id.safeParse(courseId).success) return null;
  return { storeId: store.id, ownerId: user.id, access: store.access };
}

async function allowed(ownerId: string, limit: { max: number; windowMinutes: number } = COURSE_EDIT_RATE_LIMIT, scope = "course-edit:owner"): Promise<boolean> {
  return takeRateLimit(rateLimitKey(scope, ownerId), limit.max, limit.windowMinutes);
}

/** Answers with the curriculum after a write, or the right error. */
async function after(storeId: string, courseId: string, outcome: CurriculumWrite): Promise<CurriculumResult> {
  if (outcome === "not_found") return err(NOT_FOUND);
  if (outcome === "limit") return err(`A course can have up to ${COURSE_LIMITS.modulesMax} modules and ${COURSE_LIMITS.lessonsMax} lessons.`);
  const curriculum = await loadCurriculum(storeId, courseId);
  return curriculum ? ok(curriculum) : err(NOT_FOUND);
}

/** Deletes Bunny videos that no lesson uses any more. A failure only leaves a video in the library. */
async function dropBunnyVideos(videoIds: (string | null)[]): Promise<void> {
  const config = bunnyConfig();
  if (!config) return;
  for (const videoId of videoIds) {
    if (videoId) await deleteVideo(config, videoId).catch((error: unknown) => logger.warn("courses.bunny_delete_failed", { name: errorName(error) }));
  }
}

async function run(courseId: string, work: (storeId: string) => Promise<CurriculumResult>): Promise<CurriculumResult> {
  const who = await session(courseId);
  if (!who) return err(NOT_FOUND);
  if (!(await allowed(who.ownerId))) return err(SLOW);
  try {
    return await work(who.storeId);
  } catch (error) {
    logger.error("courses.curriculum_failed", { name: errorName(error) });
    return err(FAILED);
  }
}

/** The curriculum as it is now, after asking Bunny about videos still processing (the builder polls this). */
export async function getCourseCurriculum(courseId: string): Promise<CurriculumResult> {
  return run(courseId, async (storeId) => {
    await refreshPendingVideos(storeId, courseId);
    return after(storeId, courseId, "ok");
  });
}

export async function addCourseModule(courseId: string, rawTitle: string): Promise<CurriculumResult> {
  const title = moduleTitle.safeParse(rawTitle);
  if (!title.success) return err(title.error.issues[0]?.message ?? "Check the title.", "moduleTitle");
  return run(courseId, async (storeId) => after(storeId, courseId, await addModule(storeId, courseId, title.data as string)));
}

export async function renameCourseModule(courseId: string, moduleId: string, rawTitle: string): Promise<CurriculumResult> {
  const title = moduleTitle.safeParse(rawTitle);
  if (!title.success) return err(title.error.issues[0]?.message ?? "Check the title.", "moduleTitle");
  if (!id.safeParse(moduleId).success) return err(NOT_FOUND);
  return run(courseId, async (storeId) => after(storeId, courseId, await renameModule(storeId, courseId, moduleId, title.data as string)));
}

export async function deleteCourseModule(courseId: string, moduleId: string): Promise<CurriculumResult> {
  if (!id.safeParse(moduleId).success) return err(NOT_FOUND);
  return run(courseId, async (storeId) => {
    const removed = await deleteModule(storeId, courseId, moduleId);
    if (!removed) return err(NOT_FOUND);
    await removeAttachmentsOfLessons(storeId, courseId, removed.lessonIds);
    await dropBunnyVideos(removed.bunnyVideoIds);
    return after(storeId, courseId, "ok");
  });
}

export async function addCourseLesson(courseId: string, moduleId: string, rawTitle: string): Promise<CurriculumResult> {
  const title = lessonTitle.safeParse(rawTitle);
  if (!title.success) return err(title.error.issues[0]?.message ?? "Check the title.", "lessonTitle");
  if (!id.safeParse(moduleId).success) return err(NOT_FOUND);
  return run(courseId, async (storeId) => after(storeId, courseId, await addLesson(storeId, courseId, moduleId, title.data as string)));
}

const linkInput = z.object({
  label: text(COURSE_LIMITS.linkLabel, "Link name"),
  url: httpsUrlSchema("link").refine((value) => value !== undefined, { error: "Paste a link that starts with https://" }),
});

const lessonInput = z.object({
  title: lessonTitle,
  bodyDoc: richDocSchemaWith({ maxChars: COURSE_LIMITS.notesChars, maxNodes: 3000, label: "Notes" }).nullable(),
  links: z.array(linkInput).max(COURSE_LIMITS.linksMax, { error: `Add up to ${COURSE_LIMITS.linksMax} links.` }),
  /** A YouTube or Vimeo link, "" to remove the video, or "keep" for an uploaded (or unchanged) video. */
  videoLink: z.string().max(500),
});

/** Saves a lesson's title, video link, notes and links. Payload: one JSON string. */
export async function saveCourseLesson(courseId: string, lessonId: string, payload: string): Promise<CurriculumResult> {
  if (!id.safeParse(lessonId).success || payload.length > 120_000) return err(NOT_FOUND);
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    return err("Check the lesson and try again.");
  }
  const parsed = lessonInput.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return err(issue?.message ?? "Check the lesson and try again.", typeof field === "string" ? field : undefined);
  }
  const { videoLink } = parsed.data;
  let video: "keep" | null | NonNullable<ReturnType<typeof parseVideoLink>> = "keep";
  if (videoLink === "") video = null;
  else if (videoLink !== "keep") {
    const linked = parseVideoLink(videoLink);
    if (!linked) return err("Paste a YouTube or Vimeo video link.", "videoLink");
    video = linked;
  }

  return run(courseId, async (storeId) => {
    const saved = await updateLesson(storeId, courseId, lessonId, {
      title: parsed.data.title as string,
      bodyDoc: parsed.data.bodyDoc && !isEmptyDoc(parsed.data.bodyDoc) ? parsed.data.bodyDoc : null,
      links: parsed.data.links.map((link) => ({ label: link.label ?? new URL(link.url as string).hostname, url: link.url as string })),
      video,
    });
    if (saved === "not_found") return err(NOT_FOUND);
    await dropBunnyVideos([saved.replacedBunnyVideoId]);
    return after(storeId, courseId, "ok");
  });
}

export async function deleteCourseLesson(courseId: string, lessonId: string): Promise<CurriculumResult> {
  if (!id.safeParse(lessonId).success) return err(NOT_FOUND);
  return run(courseId, async (storeId) => {
    const removed = await deleteLesson(storeId, courseId, lessonId);
    if (!removed) return err(NOT_FOUND);
    await removeAttachmentsOfLessons(storeId, courseId, [lessonId]);
    await dropBunnyVideos([removed.bunnyVideoId]);
    return after(storeId, courseId, "ok");
  });
}

const layoutInput = z.object({
  moduleIds: z.array(id).max(COURSE_LIMITS.modulesMax),
  lessons: z.array(z.object({ moduleId: id, lessonIds: z.array(id).max(COURSE_LIMITS.lessonsMax) })).max(COURSE_LIMITS.modulesMax),
});

/** Saves the order of modules and lessons after a drag or a move button. */
export async function saveCourseLayout(courseId: string, layout: unknown): Promise<CurriculumResult> {
  const parsed = layoutInput.safeParse(layout);
  if (!parsed.success) return err(NOT_FOUND);
  return run(courseId, async (storeId) => after(storeId, courseId, await saveLayout(storeId, courseId, parsed.data)));
}

export async function removeCourseAttachment(courseId: string, lessonId: string, fileId: string): Promise<CurriculumResult> {
  if (!id.safeParse(lessonId).success || !id.safeParse(fileId).success) return err(NOT_FOUND);
  return run(courseId, async (storeId) => ((await removeLessonAttachment(storeId, courseId, lessonId, fileId)) ? after(storeId, courseId, "ok") : err(NOT_FOUND)));
}

export type VideoUploadTicket = { endpoint: string; libraryId: string; videoId: string; signature: string; expires: number };

/**
 * Starts a direct upload to Bunny for a lesson: creates the video in the creator's library, points
 * the lesson at it ("uploading") and signs a TUS upload valid for 24 hours. The browser then sends
 * the file straight to Bunny; the verified Bunny webhook moves it to "ready" (or "failed").
 */
export async function startLessonVideoUpload(courseId: string, lessonId: string, rawTitle: string): Promise<Result<VideoUploadTicket>> {
  const who = await session(courseId);
  if (!who || !id.safeParse(lessonId).success) return err(NOT_FOUND);
  const config = bunnyConfig();
  if (!config) return err("Video upload isn't set up yet. Paste a YouTube or Vimeo link for now.");
  if (!(await allowed(who.ownerId, COURSE_VIDEO_UPLOAD_RATE_LIMIT, "course-video:owner"))) return err("Too many uploads. Try again in a while.");
  // The plan's hours of course video (D-098); videos already uploaded are never removed.
  const hours = videoHoursProblem(who.access, await videoSecondsUsed(who.storeId));
  if (hours) return err(hours);

  try {
    const lessons = await loadCurriculum(who.storeId, courseId);
    if (!lessons?.modules.some((module) => module.lessons.some((lesson) => lesson.id === lessonId))) return err(NOT_FOUND);
    const videoId = await createVideo(config, String(rawTitle).slice(0, 120));
    const set = await setLessonUpload(who.storeId, courseId, lessonId, videoId);
    if (set === "not_found") {
      await dropBunnyVideos([videoId]);
      return err(NOT_FOUND);
    }
    await dropBunnyVideos([set.replacedBunnyVideoId]);
    const expires = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    return ok({ endpoint: BUNNY_TUS_ENDPOINT, libraryId: config.libraryId, videoId, signature: uploadSignature(config, videoId, expires), expires });
  } catch (error) {
    logger.error("courses.video_upload_start_failed", { name: errorName(error) });
    return err("Couldn't start the upload. Try again.");
  }
}
