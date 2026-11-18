"use server";

import { revalidatePath } from "next/cache";

import { requireCreator } from "@/lib/auth/guards";
import { saveProductBump } from "@/lib/bumps/queries";
import { bumpInputFor } from "@/lib/bumps/rules";
import { PRODUCT_RATE_LIMIT } from "@/lib/config";
import { logger } from "@/lib/logger";
import { productIdInput } from "@/lib/products/schemas";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

/** Saves the order bump of one product of the session owner's store (D-089). */
export async function saveBumpAction(productId: string, input: unknown): Promise<Result<{ enabled: boolean }>> {
  const { user, store } = await requireCreator(`/dashboard/products/${productId}`);
  if (!productIdInput.safeParse(productId).success) return err("We couldn't find that product.");
  const parsed = bumpInputFor(store.currency).safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return err(issue?.message ?? "Check the order bump and try again.", typeof field === "string" ? field : undefined);
  }
  const { max, windowMinutes } = PRODUCT_RATE_LIMIT;
  if (!(await takeRateLimit(rateLimitKey("product-write:owner", user.id), max, windowMinutes))) return err("Slow down a little, then try again.");
  try {
    const result = await saveProductBump(store.id, productId, parsed.data);
    if (result === "not_found") return err("We couldn't find that product.");
    if (result === "bad_product") return err("Pick another digital product or course from your store.", "productId");
  } catch (error) {
    logger.error("bumps.save_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save the order bump. Try again.");
  }
  revalidatePath("/dashboard", "layout");
  return ok({ enabled: parsed.data !== null });
}
