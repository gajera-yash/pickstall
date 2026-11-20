"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser, requireCreator } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import { deleteReview, saveReview, setReviewStatus } from "@/lib/reviews/queries";
import { reviewInput } from "@/lib/reviews/rules";

// Reviews (D-106). Buyers act as their signed-in email; creators on their own store only.

/** The buyer's review of the product of one of their paid orders. */
export async function saveReviewAction(orderId: string, raw: unknown): Promise<Result<{ saved: true }>> {
  const user = await getCurrentUser();
  if (!user?.email) return err("Sign in to leave a review.");
  const parsed = reviewInput.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check your review and try again.");
  if (!(await takeRateLimit(rateLimitKey("review:user", user.id), 20, 60))) return err("Slow down a little, then try again.");
  try {
    if ((await saveReview(user.email, orderId, parsed.data)) === "not_found") return err("You can review products you bought (and that weren't refunded).");
  } catch (error) {
    logger.error("reviews.save_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save your review. Try again.");
  }
  revalidatePath(`/library/${orderId}`);
  return ok({ saved: true });
}

const CREATOR_PATH = "/dashboard/reviews";

async function creatorChange(reviewId: unknown, run: (storeId: string, id: string) => Promise<boolean>): Promise<Result<{ done: true }>> {
  const { user, store } = await requireCreator(CREATOR_PATH);
  if (typeof reviewId !== "string" || !isUuid(reviewId)) return err("We couldn't find that review.");
  if (!(await takeRateLimit(rateLimitKey("review-write:owner", user.id), 60, 10))) return err("Slow down a little, then try again.");
  try {
    if (!(await run(store.id, reviewId))) return err("We couldn't find that review.");
  } catch (error) {
    logger.error("reviews.change_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save. Try again.");
  }
  revalidatePath(CREATOR_PATH);
  return ok({ done: true });
}

export async function hideReviewAction(reviewId: string): Promise<Result<{ done: true }>> {
  return creatorChange(reviewId, (storeId, id) => setReviewStatus(storeId, id, "hidden"));
}

export async function showReviewAction(reviewId: string): Promise<Result<{ done: true }>> {
  return creatorChange(reviewId, (storeId, id) => setReviewStatus(storeId, id, "published"));
}

export async function deleteReviewAction(reviewId: string): Promise<Result<{ done: true }>> {
  return creatorChange(reviewId, deleteReview);
}
