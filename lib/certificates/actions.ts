"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guards";
import { certificateOfOrder, issueCertificate, type StudentCertificate } from "@/lib/certificates/queries";
import { certificateNameInput, courseFinished } from "@/lib/certificates/rules";
import { buildOutline, loadPlayerCourse } from "@/lib/courses/player";
import { completedLessons, courseAccess } from "@/lib/courses/student";
import { collections } from "@/lib/db/collections";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

// A student claims the certificate of a course they finished (D-111). The order must give this
// session's email access now, the creator must have certificates on, and every lesson must be
// complete. The only things from the client are the order id and the name to print.

const ACCESS_ERRORS: Record<string, string> = {
  refunded: "This purchase was refunded, so there is no certificate.",
  expired: "Your access to this course has ended.",
};

export async function claimCertificate(orderId: string, rawName: unknown): Promise<Result<StudentCertificate>> {
  const user = await requireUser(`/library/${orderId}/learn`);
  if (!user.email || !isUuid(orderId)) return err("We couldn't find that course.");
  const name = certificateNameInput.safeParse(typeof rawName === "string" ? rawName : "");
  if (!name.success) return err(name.error.issues[0]?.message ?? "Enter the name for your certificate.", "name");
  if (!(await takeRateLimit(rateLimitKey("certificate:user", user.id), 10, 10))) return err("Slow down a little, then try again.");

  try {
    const now = new Date();
    const access = await courseAccess(user.email, orderId, now);
    if (!access.ok) return err(ACCESS_ERRORS[access.reason] ?? "We couldn't find that course.");
    // Already issued: the name never changes afterwards.
    const existing = await certificateOfOrder(orderId);
    if (existing) return ok(existing);

    const course = await loadPlayerCourse(access.storeId, access.courseId);
    if (!course) return err("We couldn't find that course.");
    if (!course.product.course?.certificate) return err("This course doesn't give certificates.");
    const outline = buildOutline(course, access.enrolledAt, now);
    if (!courseFinished(outline.lessonIds, await completedLessons(orderId))) return err("Finish every lesson to get your certificate.");

    const { stores } = await collections();
    const store = await stores.findOne({ _id: access.storeId }, { projection: { name: 1 } });
    const certificate = await issueCertificate(access, { studentName: name.data, courseTitle: course.product.title, storeName: store?.name ?? "" }, now);
    revalidatePath(`/library/${orderId}/learn`);
    return ok(certificate);
  } catch (error) {
    logger.error("certificates.claim_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't make your certificate. Check your connection and try again.");
  }
}
