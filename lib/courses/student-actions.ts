"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guards";
import { buildOutline, loadPlayerCourse } from "@/lib/courses/player";
import { gradeQuiz, quizAnswersInput } from "@/lib/courses/quiz";
import { courseAccess, completedLessons, quizStatus, recordQuizAttempt, setLessonComplete, type CourseAccess } from "@/lib/courses/student";
import type { LessonDoc } from "@/lib/db/collections";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

// Student actions on a course lesson: "Mark as complete" (D-057) and the lesson quiz (D-110). The
// order must give this session's email access to the course now, and the lesson must be an open
// lesson of that course; nothing comes from the client but the ids (and the quiz answers).

const ACCESS_ERRORS: Record<string, string> = {
  refunded: "This purchase was refunded, so access has been removed.",
  expired: "Your access to this course has ended.",
};
const NOT_FOUND = "We couldn't find that lesson.";
const FAILED = "Couldn't save. Check your connection and try again.";

type OpenLesson = { access: Extract<CourseAccess, { ok: true }>; lesson: LessonDoc };

/** The open lesson of a course this email can use now, or the error to show. */
async function openLesson(email: string, orderId: string, lessonId: string): Promise<Result<OpenLesson>> {
  const now = new Date();
  const access = await courseAccess(email, orderId, now);
  if (!access.ok) return err(ACCESS_ERRORS[access.reason] ?? "We couldn't find that course.");
  const course = await loadPlayerCourse(access.storeId, access.courseId);
  if (!course) return err("We couldn't find that course.");
  const entry = buildOutline(course, access.enrolledAt, now).modules.flatMap((item) => item.lessons).find((item) => item.id === lessonId);
  const lesson = course.lessons.find((item) => item._id === lessonId);
  if (!entry || !lesson || entry.locked) return err("This lesson isn't open yet.");
  return ok({ access, lesson });
}

const hasQuiz = (lesson: LessonDoc) => (lesson.quiz?.questions.length ?? 0) > 0;

export async function markLessonComplete(orderId: string, lessonId: string, done: boolean): Promise<Result<{ completed: string[] }>> {
  const user = await requireUser(`/library/${orderId}/learn`);
  if (!user.email || !isUuid(orderId) || !isUuid(lessonId) || typeof done !== "boolean") return err(NOT_FOUND);
  if (!(await takeRateLimit(rateLimitKey("lesson-progress:user", user.id), 120, 10))) return err("Slow down a little, then try again.");

  try {
    const found = await openLesson(user.email, orderId, lessonId);
    if (!found.ok) return found;
    // A lesson with a quiz is complete once the quiz is passed (D-110).
    if (done && hasQuiz(found.data.lesson) && !(await quizStatus(orderId, lessonId))?.passed) return err("Pass the quiz to complete this lesson.");
    await setLessonComplete(found.data.access, lessonId, done);
    revalidatePath(`/library/${orderId}/learn`);
    return ok({ completed: await completedLessons(orderId) });
  } catch (error) {
    logger.error("courses.progress_failed", { name: error instanceof Error ? error.name : undefined });
    return err(FAILED);
  }
}

export type QuizResult = { percent: number; correctCount: number; total: number; passed: boolean; passPercent: number; results: boolean[]; bestPercent: number; attempts: number };

/**
 * Grades a quiz try on the server from the lesson's own right answers and keeps the score. Passing
 * marks the lesson complete. The answer says which questions were right, never the right options.
 */
export async function submitLessonQuiz(orderId: string, lessonId: string, rawAnswers: unknown): Promise<Result<QuizResult>> {
  const user = await requireUser(`/library/${orderId}/learn`);
  if (!user.email || !isUuid(orderId) || !isUuid(lessonId)) return err(NOT_FOUND);
  const answers = quizAnswersInput.safeParse(rawAnswers);
  if (!answers.success) return err("Answer every question, then try again.");
  if (!(await takeRateLimit(rateLimitKey("lesson-quiz:user", user.id), 30, 10))) return err("Too many tries. Wait a few minutes, then try again.");

  try {
    const found = await openLesson(user.email, orderId, lessonId);
    if (!found.ok) return found;
    const quiz = found.data.lesson.quiz;
    if (!quiz || quiz.questions.length === 0) return err("This lesson has no quiz.");
    if (answers.data.length !== quiz.questions.length) return err("The quiz has changed. Reload the page and try again.");

    const grade = gradeQuiz(quiz, answers.data);
    const status = await recordQuizAttempt(found.data.access, lessonId, grade.percent, grade.passed);
    if (grade.passed) await setLessonComplete(found.data.access, lessonId, true);
    revalidatePath(`/library/${orderId}/learn`);
    return ok({ ...grade, passPercent: quiz.passPercent, bestPercent: status.bestPercent, attempts: status.attempts });
  } catch (error) {
    logger.error("courses.quiz_failed", { name: error instanceof Error ? error.name : undefined });
    return err(FAILED);
  }
}
