"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCreator } from "@/lib/auth/guards";
import { PRODUCT_RATE_LIMIT } from "@/lib/config";
import { DRIP_DAYS_MAX } from "@/lib/courses/drip";
import { updateCourseDetails, updateCourseRelease } from "@/lib/courses/queries";
import { COURSE_LIMITS } from "@/lib/courses/settings";
import { courseDetailsInputFor } from "@/lib/courses/schemas";
import { logger } from "@/lib/logger";
import { createDraftProduct } from "@/lib/products/queries";
import { productIdInput } from "@/lib/products/schemas";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

// Course editor actions (course flow G1, D-054). The course is always found with the session
// owner's store id; every field is checked again on the server, prices in the store's currency.

export type SaveCourseState = Result<{ savedAt: number }> | null;

const MAX_PAYLOAD_CHARS = 40_000;
const NOT_FOUND = "We couldn't find that course. Reload the page and try again.";

function errorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

async function allowed(ownerId: string): Promise<boolean> {
  const { max, windowMinutes } = PRODUCT_RATE_LIMIT;
  return takeRateLimit(rateLimitKey("product-write:owner", ownerId), max, windowMinutes);
}

/** Creates an empty draft course (lifetime access, free until priced) and opens its editor. */
export async function createCourseAndEdit(): Promise<void> {
  const { user, store } = await requireCreator("/dashboard/products/new");
  if (!(await allowed(user.id))) redirect("/dashboard/products?error=slow");
  const result = await createDraftProduct(store.id, { buttonText: "Enroll now", type: "course" }).catch((error: unknown) => {
    logger.error("courses.create_failed", { name: errorName(error) });
    return "error" as const;
  });
  if (typeof result === "string") redirect(`/dashboard/products?error=${result}`);
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/products/${result.id}`);
}

/** Saves the course editor's Basic and Pricing steps. */
export async function saveCourseDetails(courseId: string, _prev: SaveCourseState, formData: FormData): Promise<SaveCourseState> {
  const { user, store } = await requireCreator(`/dashboard/products/${courseId}`);
  if (!productIdInput.safeParse(courseId).success) return err(NOT_FOUND);

  const raw = formData.get("payload");
  if (typeof raw !== "string" || raw.length > MAX_PAYLOAD_CHARS) return err("Check the form and try again.");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return err("Check the form and try again.");
  }

  const parsed = courseDetailsInputFor(store.currency).safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return err(issue?.message ?? "Check the form and try again.", typeof field === "string" ? field : undefined);
  }
  if (!(await allowed(user.id))) return err("Slow down a little, then try again.");

  try {
    if ((await updateCourseDetails(store.id, courseId, parsed.data)) === "not_found") return err(NOT_FOUND);
  } catch (error) {
    logger.error("courses.save_failed", { name: errorName(error) });
    return err("Couldn't save your course. Check your connection and try again.");
  }

  revalidatePath("/dashboard", "layout");
  return ok({ savedAt: Date.now() });
}

const releaseInput = z.object({
  drip: z.boolean(),
  modules: z
    .array(
      z.object({
        id: z.uuid(),
        dripDays: z.number().int({ error: "Use whole days." }).min(0, { error: "Use 0 or more days." }).max(DRIP_DAYS_MAX, { error: `Use ${DRIP_DAYS_MAX} days or fewer.` }),
      }),
    )
    .max(COURSE_LIMITS.modulesMax),
});

/** Saves how the course opens (D-056): all lessons at once, or each module N days after purchase. */
export async function saveCourseRelease(courseId: string, input: unknown): Promise<Result<{ savedAt: number }>> {
  const { user, store } = await requireCreator(`/dashboard/products/${courseId}`);
  if (!productIdInput.safeParse(courseId).success) return err(NOT_FOUND);
  const parsed = releaseInput.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the unlock days.", "drip");
  if (!(await allowed(user.id))) return err("Slow down a little, then try again.");
  try {
    if ((await updateCourseRelease(store.id, courseId, parsed.data)) === "not_found") return err(NOT_FOUND);
  } catch (error) {
    logger.error("courses.release_failed", { name: errorName(error) });
    return err("Couldn't save. Check your connection and try again.");
  }
  revalidatePath("/dashboard", "layout");
  return ok({ savedAt: Date.now() });
}
