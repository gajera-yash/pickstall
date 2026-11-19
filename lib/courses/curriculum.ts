import "server-only";

import { randomUUID } from "node:crypto";

import type { AnyBulkWriteOperation } from "mongodb";

import { COURSE_LIMITS } from "@/lib/courses/settings";
import { lessonHasContent, type Curriculum } from "@/lib/courses/curriculum-types";
import { collections, type CourseModuleDoc, type LessonDoc, type LessonLinkDoc, type LessonVideoDoc } from "@/lib/db/collections";
import { PRODUCT_FILE_TYPES } from "@/lib/files/types";
import { notify } from "@/lib/notifications/queries";
import type { RichDoc } from "@/lib/products/rich-text";

// Course curriculum reads and writes for the signed-in creator (D-055). Every query filters by the
// store id of `requireCreator()` and the course id, and the course must be a "course" of that
// store; ids from the client are only ever combined with those filters.

export type CurriculumWrite = "ok" | "not_found" | "limit";

async function ownsCourse(storeId: string, courseId: string): Promise<boolean> {
  const { products } = await collections();
  // A deleted course (D-059) can no longer be edited; its students still see it through the player.
  return (await products.countDocuments({ _id: courseId, storeId, type: "course", deletedAt: null }, { limit: 1 })) === 1;
}

/** The whole curriculum of one of this store's courses, in order, or null when it is not theirs. */
export async function loadCurriculum(storeId: string, courseId: string): Promise<Curriculum | null> {
  if (!(await ownsCourse(storeId, courseId))) return null;
  const { courseModules, lessons, files } = await collections();
  const [moduleDocs, lessonDocs, fileDocs] = await Promise.all([
    courseModules.find({ storeId, productId: courseId }).sort({ sortOrder: 1 }).toArray(),
    lessons.find({ storeId, productId: courseId }).sort({ sortOrder: 1 }).toArray(),
    files.find({ storeId, productId: courseId, lessonId: { $type: "string" }, status: { $ne: "pending" } }, { projection: { name: 1, size: 1, ext: 1, lessonId: 1 } }).sort({ createdAt: 1 }).toArray(),
  ]);
  return {
    modules: moduleDocs.map((module) => ({
      id: module._id,
      title: module.title,
      dripDays: module.dripDays,
      lessons: lessonDocs
        .filter((lesson) => lesson.moduleId === module._id)
        .map((lesson) => ({
          id: lesson._id,
          title: lesson.title,
          // The creator sees the status of an upload, never the Bunny video id.
          video: lesson.video === null ? null : lesson.video.kind === "bunny" ? { kind: "bunny" as const, status: lesson.video.status } : lesson.video,
          bodyDoc: lesson.bodyDoc,
          links: lesson.links,
          attachments: fileDocs
            .filter((file) => file.lessonId === lesson._id)
            .map((file) => ({ id: file._id, name: file.name, size: file.size, label: PRODUCT_FILE_TYPES[file.ext]?.label ?? file.ext.toUpperCase() })),
        })),
    })),
  };
}

/** How many lessons of this store's course have something for students (the publish rule). */
export async function countLessonsWithContent(storeId: string, courseId: string): Promise<number> {
  const curriculum = await loadCurriculum(storeId, courseId);
  return curriculum ? curriculum.modules.reduce((sum, item) => sum + item.lessons.filter(lessonHasContent).length, 0) : 0;
}

export async function addModule(storeId: string, courseId: string, title: string): Promise<CurriculumWrite> {
  if (!(await ownsCourse(storeId, courseId))) return "not_found";
  const { courseModules } = await collections();
  if ((await courseModules.countDocuments({ storeId, productId: courseId })) >= COURSE_LIMITS.modulesMax) return "limit";
  const now = new Date();
  await courseModules.insertOne({ _id: randomUUID(), storeId, productId: courseId, title, sortOrder: Date.now(), dripDays: null, createdAt: now, updatedAt: now });
  return "ok";
}

export async function renameModule(storeId: string, courseId: string, moduleId: string, title: string): Promise<CurriculumWrite> {
  const { courseModules } = await collections();
  const result = await courseModules.updateOne({ _id: moduleId, storeId, productId: courseId }, { $set: { title, updatedAt: new Date() } });
  return result.matchedCount === 1 ? "ok" : "not_found";
}

/** Removes a module and its lessons. Returns what the caller must clean up outside the database. */
export async function deleteModule(storeId: string, courseId: string, moduleId: string): Promise<{ bunnyVideoIds: string[]; lessonIds: string[] } | null> {
  const { courseModules, lessons } = await collections();
  const removedModule = await courseModules.findOneAndDelete({ _id: moduleId, storeId, productId: courseId });
  if (!removedModule) return null;
  const removed = await lessons.find({ storeId, productId: courseId, moduleId }, { projection: { video: 1 } }).toArray();
  await lessons.deleteMany({ storeId, productId: courseId, moduleId });
  return { bunnyVideoIds: bunnyIdsOf(removed), lessonIds: removed.map((lesson) => lesson._id) };
}

export async function addLesson(storeId: string, courseId: string, moduleId: string, title: string): Promise<CurriculumWrite> {
  const { courseModules, lessons } = await collections();
  if ((await courseModules.countDocuments({ _id: moduleId, storeId, productId: courseId }, { limit: 1 })) !== 1) return "not_found";
  if (!(await ownsCourse(storeId, courseId))) return "not_found";
  if ((await lessons.countDocuments({ storeId, productId: courseId })) >= COURSE_LIMITS.lessonsMax) return "limit";
  const now = new Date();
  const doc: LessonDoc = { _id: randomUUID(), storeId, productId: courseId, moduleId, title, sortOrder: Date.now(), video: null, bodyDoc: null, links: [], createdAt: now, updatedAt: now };
  await lessons.insertOne(doc);
  return "ok";
}

export type LessonUpdate = {
  title: string;
  bodyDoc: RichDoc | null;
  links: LessonLinkDoc[];
  /** "keep" leaves the video as it is (an upload runs separately); null removes it. */
  video: Extract<LessonVideoDoc, { kind: "youtube" | "vimeo" }> | null | "keep";
};

/** Saves a lesson. Returns the Bunny video it replaced (to delete), or "not_found". */
export async function updateLesson(storeId: string, courseId: string, lessonId: string, update: LessonUpdate): Promise<{ replacedBunnyVideoId: string | null } | "not_found"> {
  const { lessons } = await collections();
  const filter = { _id: lessonId, storeId, productId: courseId };
  const current = await lessons.findOne(filter, { projection: { video: 1 } });
  if (!current) return "not_found";
  const set: Partial<LessonDoc> = { title: update.title, bodyDoc: update.bodyDoc, links: update.links, updatedAt: new Date() };
  if (update.video !== "keep") set.video = update.video;
  const result = await lessons.updateOne(filter, { $set: set });
  if (result.matchedCount !== 1) return "not_found";
  const replaced = update.video !== "keep" && current.video?.kind === "bunny" ? current.video.videoId : null;
  return { replacedBunnyVideoId: replaced };
}

/** Removes a lesson. Returns its Bunny video (to delete), or null when it is not this course's. */
export async function deleteLesson(storeId: string, courseId: string, lessonId: string): Promise<{ bunnyVideoId: string | null } | null> {
  const { lessons } = await collections();
  const lesson = await lessons.findOneAndDelete({ _id: lessonId, storeId, productId: courseId });
  if (!lesson) return null;
  return { bunnyVideoId: lesson.video?.kind === "bunny" ? lesson.video.videoId : null };
}

/** Points a lesson at a new Bunny upload. Returns the Bunny video it replaced, or "not_found". */
export async function setLessonUpload(storeId: string, courseId: string, lessonId: string, videoId: string): Promise<{ replacedBunnyVideoId: string | null } | "not_found"> {
  const { lessons } = await collections();
  const filter = { _id: lessonId, storeId, productId: courseId };
  const current = await lessons.findOneAndUpdate(filter, { $set: { video: { kind: "bunny", videoId, status: "uploading" }, updatedAt: new Date() } }, { projection: { video: 1 } });
  if (!current) return "not_found";
  return { replacedBunnyVideoId: current.video?.kind === "bunny" && current.video.videoId !== videoId ? current.video.videoId : null };
}

export type Layout = { moduleIds: string[]; lessons: { moduleId: string; lessonIds: string[] }[] };

/**
 * Saves the order of modules and lessons after a drag (or the up/down buttons), including lessons
 * moved to another module. The layout must name exactly this course's modules and lessons, each
 * once; anything else is refused, so a layout can never pull in another course's lesson.
 */
export async function saveLayout(storeId: string, courseId: string, layout: Layout): Promise<CurriculumWrite> {
  if (!(await ownsCourse(storeId, courseId))) return "not_found";
  const { courseModules, lessons } = await collections();
  const [moduleDocs, lessonDocs] = await Promise.all([
    courseModules.find({ storeId, productId: courseId }, { projection: { _id: 1 } }).toArray(),
    lessons.find({ storeId, productId: courseId }, { projection: { _id: 1 } }).toArray(),
  ]);
  const sameSet = (a: string[], b: string[]) => a.length === b.length && new Set(a).size === a.length && b.every((id) => a.includes(id));
  const layoutLessonIds = layout.lessons.flatMap((group) => group.lessonIds);
  // Each lesson group names one of the course's modules, at most once.
  const groupIds = layout.lessons.map((group) => group.moduleId);
  const groupsMatch = new Set(groupIds).size === groupIds.length && groupIds.every((id) => layout.moduleIds.includes(id));
  if (!sameSet(layout.moduleIds, moduleDocs.map((doc) => doc._id)) || !sameSet(layoutLessonIds, lessonDocs.map((doc) => doc._id)) || !groupsMatch) return "not_found";

  const now = new Date();
  const moduleOps: AnyBulkWriteOperation<CourseModuleDoc>[] = layout.moduleIds.map((id, index) => ({
    updateOne: { filter: { _id: id, storeId, productId: courseId }, update: { $set: { sortOrder: index, updatedAt: now } } },
  }));
  const lessonOps: AnyBulkWriteOperation<LessonDoc>[] = layout.lessons.flatMap((group) =>
    group.lessonIds.map((id, index) => ({
      updateOne: { filter: { _id: id, storeId, productId: courseId }, update: { $set: { moduleId: group.moduleId, sortOrder: index, updatedAt: now } } },
    })),
  );
  if (moduleOps.length > 0) await courseModules.bulkWrite(moduleOps, { ordered: false });
  if (lessonOps.length > 0) await lessons.bulkWrite(lessonOps, { ordered: false });
  return "ok";
}

/** Removes the whole curriculum of a deleted course. Returns its Bunny videos (to delete). */
export async function removeCurriculumOf(storeId: string, courseId: string): Promise<string[]> {
  const { courseModules, lessons } = await collections();
  const removed = await lessons.find({ storeId, productId: courseId }, { projection: { video: 1 } }).toArray();
  await Promise.all([lessons.deleteMany({ storeId, productId: courseId }), courseModules.deleteMany({ storeId, productId: courseId })]);
  return bunnyIdsOf(removed);
}

function bunnyIdsOf(docs: Pick<LessonDoc, "video">[]): string[] {
  return docs.flatMap((doc) => (doc.video?.kind === "bunny" ? [doc.video.videoId] : []));
}

/**
 * The Bunny webhook's status update for a video (not store-scoped: Bunny is the caller, and the
 * signature was checked). A late "processing" never undoes "ready", and "failed" never undoes "ready".
 */
export async function setBunnyVideoStatus(videoId: string, status: "processing" | "ready" | "failed"): Promise<number> {
  const { lessons } = await collections();
  const from: Record<typeof status, ("uploading" | "processing" | "ready" | "failed")[]> = {
    processing: ["uploading"],
    failed: ["uploading", "processing"],
    ready: ["uploading", "processing", "failed"],
  };
  const filter = { "video.kind": "bunny" as const, "video.videoId": videoId, "video.status": { $in: from[status] } };
  // The lessons about to change, for the creator's "video ready / failed" notification (D-061).
  const changing = status === "processing" ? [] : await lessons.find(filter, { projection: { storeId: 1, productId: 1, title: 1 } }).toArray();
  const result = await lessons.updateMany(filter, { $set: { "video.status": status, updatedAt: new Date() } });
  for (const lesson of changing) {
    await notify({
      storeId: lesson.storeId,
      kind: status === "ready" ? "video_ready" : "video_failed",
      dedupeKey: `video:${videoId}:${status}`,
      title: status === "ready" ? "Video ready" : "Video upload failed",
      body: status === "ready" ? `${lesson.title} can be watched now.` : `${lesson.title}: upload the video again.`,
      href: `/dashboard/products/${lesson.productId}`,
    });
  }
  return result.modifiedCount;
}
