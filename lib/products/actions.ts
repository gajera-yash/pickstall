"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCreator } from "@/lib/auth/guards";
import { PRODUCT_RATE_LIMIT } from "@/lib/config";
import { recordAudit } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { removeCourseContent } from "@/lib/courses/cleanup";
import { countLessonsWithContent } from "@/lib/courses/curriculum";
import { removeFilesOfProduct } from "@/lib/files/product-files";
import { can, PAUSED_MESSAGES, planProblem } from "@/lib/plans/access";
import { checkPublish } from "@/lib/products/publish";
import { createDraftProduct, deleteProduct, findProduct, setProductStatus, updateProduct, type DeleteProductResult } from "@/lib/products/queries";
import { productIdInput, productInputFor, productStatusInput } from "@/lib/products/schemas";
import { countPublishedCourses } from "@/lib/plans/usage";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

/** `published` is true when the save also published the product (intent=publish, D-048). */
export type SaveProductState = Result<{ savedAt: number; published: boolean }> | null;
export type ProductStatusState = Result<{ status: string }> | null;

const MAX_PAYLOAD_CHARS = 40_000;
const SAVE_FAILED = "Couldn't save your product. Check your connection and try again.";
const NOT_FOUND = "We couldn't find that product. Reload the page and try again.";

function errorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

async function allowed(ownerId: string): Promise<boolean> {
  const { max, windowMinutes } = PRODUCT_RATE_LIMIT;
  return takeRateLimit(rateLimitKey("product-write:owner", ownerId), max, windowMinutes);
}

/** Creates an empty draft lead magnet (D-094) and opens the digital editor for it. */
export async function createLeadMagnetAndEdit(formData?: FormData): Promise<void> {
  return createAndEdit(formData, "lead_magnet");
}

/** Creates an empty draft digital product and opens its editor. */
export async function createProductAndEdit(formData?: FormData): Promise<void> {
  return createAndEdit(formData, "digital");
}

async function createAndEdit(formData: FormData | undefined, type: "digital" | "lead_magnet"): Promise<void> {
  const { user, store } = await requireCreator("/dashboard/products/new");
  const from = formData?.get("from");
  // From the setup wizard, problems go back there: the products list is locked during setup (D-079).
  const errorPath = from === "setup" ? "/dashboard/setup?step=first-product&error=" : "/dashboard/products?error=";
  if (!(await allowed(user.id))) redirect(`${errorPath}slow`);
  const result = await createDraftProduct(store.id, type === "lead_magnet" ? { buttonText: "Send it to me", type } : { buttonText: "Buy now" }).catch((error: unknown) => {
    logger.error("products.create_failed", { name: errorName(error) });
    return "error" as const;
  });
  if (typeof result === "string") redirect(`${errorPath}${result}`);
  revalidatePath("/dashboard", "layout");
  const query = from === "setup" ? "?from=setup" : "";
  redirect(`/dashboard/products/${result.id}${query}`);
}

/**
 * Saves the product editor. The form arrives as one JSON payload; the product is found with the
 * session owner's store id, so a creator can only ever change their own products. With
 * `intent=publish` (the editor's "Save and publish" button, D-048) it then publishes, checking the
 * publish rules on the product as just saved; if a rule fails, the save stands and the problems
 * come back as the error.
 */
export async function saveProduct(productId: string, _prev: SaveProductState, formData: FormData): Promise<SaveProductState> {
  const { user, store } = await requireCreator(`/dashboard/products/${productId}`);
  if (!productIdInput.safeParse(productId).success) return err(NOT_FOUND);

  const raw = formData.get("payload");
  if (typeof raw !== "string" || raw.length > MAX_PAYLOAD_CHARS) return err("Check the form and try again.");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return err("Check the form and try again.");
  }

  // Prices are read in the store's own currency (D-046).
  const parsed = productInputFor(store.currency).safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const [first, index] = issue?.path ?? [];
    const field = first === "questions" && typeof index === "number" ? `question-${index}` : typeof first === "string" ? first : undefined;
    return err(issue?.message ?? "Check the form and try again.", field);
  }
  if (!(await allowed(user.id))) return err("Slow down a little, then try again.");

  const publish = formData.get("intent") === "publish";
  try {
    const result = await updateProduct(store.id, productId, parsed.data);
    if (result === "not_found") return err(NOT_FOUND);
    if (publish) {
      // A paused store (trial over, D-072) keeps its edits but cannot publish.
      if (!can(store.access, "publish")) {
        revalidatePath("/dashboard", "layout");
        return err(`Saved, but not published: ${PAUSED_MESSAGES.publish}`);
      }
      const saved = await findProduct(store.id, productId);
      if (!saved) return err(NOT_FOUND);
      const check = checkPublish(saved, store);
      if (!check.ok) {
        revalidatePath("/dashboard", "layout");
        return err(`Saved, but not published yet: ${check.problems.join(" ")}`);
      }
      if (!(await setProductStatus(store.id, productId, "published"))) return err(NOT_FOUND);
    }
  } catch (error) {
    logger.error("products.save_failed", { name: errorName(error) });
    return err(SAVE_FAILED);
  }

  revalidatePath("/dashboard", "layout");
  return ok({ savedAt: Date.now(), published: publish });
}

/** Publish, unpublish (back to draft) or archive. Publishing checks the rules on the saved product. */
export async function changeProductStatus(productId: string, status: string): Promise<Result<{ status: string }>> {
  const { user, store } = await requireCreator("/dashboard/products");
  const id = productIdInput.safeParse(productId);
  const next = productStatusInput.safeParse(status);
  if (!id.success || !next.success) return err(NOT_FOUND);
  if (!(await allowed(user.id))) return err("Slow down a little, then try again.");

  try {
    const product = await findProduct(store.id, id.data);
    if (!product) return err(NOT_FOUND);

    if (next.data === "published") {
      if (!can(store.access, "publish")) return err(PAUSED_MESSAGES.publish);
      // The plan (D-098): Pro for coaching calls, and the course limit (after a downgrade, the
      // courses already published stay; no more can be published).
      if (product.type === "course" || product.type === "coaching") {
        const courses = product.type === "course" ? await countPublishedCourses(store.id, id.data) : undefined;
        const problem = planProblem(store.access, { type: product.type, courses });
        if (problem) return err(problem);
      }
      // A course is checked with its lessons (D-056).
      const courseLessons = product.type === "course" ? await countLessonsWithContent(store.id, id.data) : undefined;
      const check = checkPublish({ ...product, courseLessons }, store);
      if (!check.ok) return err(check.problems.join(" "));
    }
    if (!(await setProductStatus(store.id, id.data, next.data))) return err(NOT_FOUND);
  } catch (error) {
    logger.error("products.status_failed", { name: errorName(error) });
    return err(SAVE_FAILED);
  }

  revalidatePath("/dashboard", "layout");
  return ok({ status: next.data });
}

/** Deletes a draft or archived product. */
/** `kept` is true when the product had orders and was hidden instead, so its buyers keep access (D-059). */
export async function removeProduct(productId: string): Promise<Result<{ deleted: true; kept: boolean }>> {
  const { user, store } = await requireCreator("/dashboard/products");
  const id = productIdInput.safeParse(productId);
  if (!id.success) return err(NOT_FOUND);
  if (!(await allowed(user.id))) return err("Slow down a little, then try again.");

  let result: DeleteProductResult;
  try {
    result = await deleteProduct(store.id, id.data);
    if (result === "not_found") return err(NOT_FOUND);
    if (result === "deleted") {
      // Gone for good: its file goes too (a failure here only leaves an orphan file behind).
      await removeFilesOfProduct(store.id, id.data).catch((error: unknown) => logger.warn("products.file_cleanup_failed", { name: errorName(error) }));
      // A course also loses its modules, lessons and Bunny videos (D-055).
      await removeCourseContent(store.id, id.data).catch((error: unknown) => logger.warn("courses.cleanup_failed", { name: errorName(error) }));
    }
    // "hidden": files and lessons stay, because buyers keep access.
  } catch (error) {
    logger.error("products.delete_failed", { name: errorName(error) });
    return err(SAVE_FAILED);
  }

  await recordAudit({ actorId: user.id, storeId: store.id, action: "product.deleted", meta: { productId: id.data } });
  revalidatePath("/dashboard", "layout");
  return ok({ deleted: true, kept: result === "hidden" });
}
