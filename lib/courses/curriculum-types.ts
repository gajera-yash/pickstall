import type { ProductFileInfo } from "@/lib/files/types";
import type { RichDoc } from "@/lib/products/rich-text";

// The curriculum as the course editor sees it (D-055). Client-safe types only. This is the
// creator's own view: students get lesson content only through the access checks of G4.

export type EditorLessonVideo =
  | { kind: "bunny"; status: "uploading" | "processing" | "ready" | "failed" }
  | { kind: "youtube"; id: string }
  | { kind: "vimeo"; id: string; hash: string | null };

export type EditorLesson = {
  id: string;
  title: string;
  video: EditorLessonVideo | null;
  bodyDoc: RichDoc | null;
  links: { label: string; url: string }[];
  attachments: ProductFileInfo[];
};

export type EditorModule = { id: string; title: string; dripDays: number | null; lessons: EditorLesson[] };

export type Curriculum = { modules: EditorModule[] };

/** How many lessons the curriculum holds. */
export const lessonCount = (curriculum: Curriculum) => curriculum.modules.reduce((sum, module) => sum + module.lessons.length, 0);

/** True when a lesson has something for students: a video, notes or a resource. */
export function lessonHasContent(lesson: Pick<EditorLesson, "video" | "bodyDoc" | "links" | "attachments">): boolean {
  return lesson.video !== null || (lesson.bodyDoc?.content.length ?? 0) > 0 || lesson.links.length > 0 || lesson.attachments.length > 0;
}
