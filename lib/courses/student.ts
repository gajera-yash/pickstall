import "server-only";

import { accessEndsAt } from "@/lib/courses/access";
import { collections } from "@/lib/db/collections";
import { isUuid } from "@/lib/media/media";

// A student's access to a course they bought (D-057). A student is identified by the verified email
// of their session, like the buyer library (R7). Every lesson, file and "Mark as complete" goes
// through `courseAccess` first: the order is this email's, it is paid (a refund ends access, D-053
// keeps a partly refunded order paid), the product is a course of the order's store, and the access
// period (if any) has not ended. Drip locks are checked per lesson by the caller with the outline.

export type CourseAccess =
  | { ok: true; orderId: string; storeId: string; courseId: string; enrolledAt: Date; expiresAt: Date | null }
  | { ok: false; reason: "not_found" | "refunded" | "expired" | "not_course" };

const normalize = (email: string) => email.trim().toLowerCase();

export async function courseAccess(email: string, orderId: string, now: Date = new Date()): Promise<CourseAccess> {
  if (!isUuid(orderId) || !email) return { ok: false, reason: "not_found" };
  const { orders, products } = await collections();
  const order = await orders.findOne({ _id: orderId, buyerEmail: normalize(email) }, { projection: { productId: 1, storeId: 1, status: 1, paidAt: 1 } });
  if (!order) return { ok: false, reason: "not_found" };
  if (order.status === "refunded") return { ok: false, reason: "refunded" };
  if (order.status !== "paid" || !order.paidAt) return { ok: false, reason: "not_found" };

  const product = await products.findOne({ _id: order.productId, storeId: order.storeId }, { projection: { type: 1, "course.accessDays": 1 } });
  if (!product) return { ok: false, reason: "not_found" };
  if (product.type !== "course") return { ok: false, reason: "not_course" };

  const expiresAt = accessEndsAt(order.paidAt, product.course?.accessDays);
  if (expiresAt && now.getTime() >= expiresAt.getTime()) return { ok: false, reason: "expired" };
  return { ok: true, orderId, storeId: order.storeId, courseId: order.productId, enrolledAt: order.paidAt, expiresAt };
}

/** The lessons this order has marked complete. */
export async function completedLessons(orderId: string): Promise<string[]> {
  const { lessonProgress } = await collections();
  const docs = await lessonProgress.find({ orderId }, { projection: { lessonId: 1 } }).toArray();
  return docs.map((doc) => doc.lessonId);
}

/** Marks a lesson complete (or not) for an order the caller has checked with `courseAccess`. */
export async function setLessonComplete(access: Extract<CourseAccess, { ok: true }>, lessonId: string, done: boolean): Promise<void> {
  const { lessonProgress } = await collections();
  const _id = `${access.orderId}:${lessonId}`;
  if (done) {
    await lessonProgress.updateOne(
      { _id },
      { $setOnInsert: { orderId: access.orderId, storeId: access.storeId, productId: access.courseId, lessonId, completedAt: new Date() } },
      { upsert: true },
    );
  } else {
    await lessonProgress.deleteOne({ _id, orderId: access.orderId });
  }
}

export type QuizStatus = { attempts: number; lastPercent: number; bestPercent: number; passed: boolean };

/** This order's quiz results for one lesson, or null before the first try (D-110). */
export async function quizStatus(orderId: string, lessonId: string): Promise<QuizStatus | null> {
  const { quizAttempts } = await collections();
  const doc = await quizAttempts.findOne({ _id: `${orderId}:${lessonId}`, orderId });
  return doc ? { attempts: doc.attempts, lastPercent: doc.lastPercent, bestPercent: doc.bestPercent, passed: doc.passedAt !== null } : null;
}

/** Saves one graded try for an order the caller has checked with `courseAccess`. Keeps the best score and the first pass. */
export async function recordQuizAttempt(access: Extract<CourseAccess, { ok: true }>, lessonId: string, percent: number, passed: boolean, now: Date = new Date()): Promise<QuizStatus> {
  const { quizAttempts } = await collections();
  const _id = `${access.orderId}:${lessonId}`;
  await quizAttempts.updateOne(
    { _id, orderId: access.orderId },
    {
      $setOnInsert: { storeId: access.storeId, productId: access.courseId, lessonId, passedAt: null },
      $inc: { attempts: 1 },
      $set: { lastPercent: percent, updatedAt: now },
      $max: { bestPercent: percent },
    },
    { upsert: true },
  );
  // The first pass is kept once; failing later never takes it away.
  if (passed) await quizAttempts.updateOne({ _id, orderId: access.orderId, passedAt: null }, { $set: { passedAt: now } });
  return (await quizStatus(access.orderId, lessonId)) ?? { attempts: 1, lastPercent: percent, bestPercent: percent, passed };
}
