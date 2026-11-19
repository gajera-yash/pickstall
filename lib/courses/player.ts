import "server-only";

import { isUnlocked, unlockDay } from "@/lib/courses/drip";
import { embedUrlFor } from "@/lib/courses/video-links";
import { collections, type CourseModuleDoc, type FileDoc, type LessonDoc, type ProductDoc } from "@/lib/db/collections";
import { PRODUCT_FILE_TYPES, type ProductFileInfo } from "@/lib/files/types";
import type { RichDoc } from "@/lib/products/rich-text";
import { bunnyConfig, playbackUrl } from "@/lib/video/bunny";

// The course player's data (D-056): the creator's preview (G3) and the student view (G4). The
// loader filters by store and course; the outline says which modules are open for a given
// enrollment date (or all of them for the creator's preview), and a lesson's video becomes a signed,
// short-lived Bunny link or a YouTube/Vimeo embed built from its id.

/** Signed Bunny player links stop working after this long; the page asks for a new one on load. */
const PLAYBACK_SECONDS = 60 * 60;

export type PlayerVideo = { kind: "embed"; url: string; provider: "bunny" | "youtube" | "vimeo" } | { kind: "processing" } | { kind: "unavailable" } | null;

export type PlayerLesson = {
  id: string;
  title: string;
  video: PlayerVideo;
  bodyDoc: RichDoc | null;
  links: { label: string; url: string }[];
  files: ProductFileInfo[];
};

export type OutlineLesson = { id: string; title: string; hasVideo: boolean; locked: boolean };
export type OutlineModule = { id: string; title: string; unlockDay: number; locked: boolean; lessons: OutlineLesson[] };
export type PlayerOutline = { modules: OutlineModule[]; lessonIds: string[] };

export type PlayerCourse = {
  product: Pick<ProductDoc, "_id" | "title" | "course">;
  modules: CourseModuleDoc[];
  lessons: LessonDoc[];
  files: FileDoc[];
};

/** One course of this store with its whole curriculum, or null when it is not theirs. */
export async function loadPlayerCourse(storeId: string, courseId: string): Promise<PlayerCourse | null> {
  const { products, courseModules, lessons, files } = await collections();
  const product = await products.findOne({ _id: courseId, storeId, type: "course" }, { projection: { title: 1, course: 1 } });
  if (!product) return null;
  const [moduleDocs, lessonDocs, fileDocs] = await Promise.all([
    courseModules.find({ storeId, productId: courseId }).sort({ sortOrder: 1 }).toArray(),
    lessons.find({ storeId, productId: courseId }).sort({ sortOrder: 1 }).toArray(),
    files.find({ storeId, productId: courseId, lessonId: { $type: "string" }, status: { $ne: "pending" } }).sort({ createdAt: 1 }).toArray(),
  ]);
  return { product, modules: moduleDocs, lessons: lessonDocs, files: fileDocs };
}

/**
 * The course outline. With `enrolledAt` null (the creator's preview) every module is open and keeps
 * its unlock day as a label; for a student, drip modules stay locked until their day.
 */
export function buildOutline(course: Pick<PlayerCourse, "product" | "modules" | "lessons">, enrolledAt: Date | null, now: Date): PlayerOutline {
  const drip = course.product.course?.drip ?? false;
  const modules = course.modules.map((item) => {
    const locked = enrolledAt !== null && !isUnlocked(drip, item.dripDays, enrolledAt, now);
    return {
      id: item._id,
      title: item.title,
      unlockDay: unlockDay(drip, item.dripDays),
      locked,
      lessons: course.lessons.filter((lesson) => lesson.moduleId === item._id).map((lesson) => ({ id: lesson._id, title: lesson.title, hasVideo: lesson.video !== null, locked })),
    };
  });
  return { modules, lessonIds: modules.flatMap((item) => item.lessons.map((lesson) => lesson.id)) };
}

/** A lesson's video for the player: a signed Bunny link only when it is ready. */
export function playerVideoOf(video: LessonDoc["video"], now: Date): PlayerVideo {
  if (!video) return null;
  if (video.kind === "youtube" || video.kind === "vimeo") return { kind: "embed", url: embedUrlFor(video), provider: video.kind };
  if (video.status === "uploading" || video.status === "processing") return { kind: "processing" };
  const config = bunnyConfig();
  if (video.status !== "ready" || !config) return { kind: "unavailable" };
  // Null in production without a token key: an unsigned link would be shareable.
  const url = playbackUrl(config, video.videoId, Math.floor(now.getTime() / 1000) + PLAYBACK_SECONDS);
  return url ? { kind: "embed", url, provider: "bunny" } : { kind: "unavailable" };
}

/** One lesson of the course, ready to show. The caller has already checked access and the lock. */
export function playerLessonOf(course: Pick<PlayerCourse, "lessons" | "files">, lessonId: string, now: Date): PlayerLesson | null {
  const lesson = course.lessons.find((item) => item._id === lessonId);
  if (!lesson) return null;
  return {
    id: lesson._id,
    title: lesson.title,
    video: playerVideoOf(lesson.video, now),
    bodyDoc: lesson.bodyDoc,
    links: lesson.links,
    files: course.files
      .filter((file) => file.lessonId === lesson._id)
      .map((file) => ({ id: file._id, name: file.name, size: file.size, label: PRODUCT_FILE_TYPES[file.ext]?.label ?? file.ext.toUpperCase() })),
  };
}
