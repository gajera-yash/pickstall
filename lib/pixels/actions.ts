"use server";

import { revalidatePath } from "next/cache";

import { requireCreator } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { savePixelSettings } from "@/lib/pixels/queries";
import { pixelsInput, type StorePixels } from "@/lib/pixels/rules";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

/** Saves the pixel IDs of the session owner's store (D-097). Empty fields remove a pixel. */
export async function savePixelsAction(raw: unknown): Promise<Result<StorePixels>> {
  const { user, store } = await requireCreator("/dashboard/marketing");
  const parsed = pixelsInput.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return err(issue?.message ?? "Check the IDs and try again.", typeof field === "string" ? field : undefined);
  }
  if (!(await takeRateLimit(rateLimitKey("pixels-write:owner", user.id), 30, 10))) return err("Slow down a little, then try again.");
  try {
    await savePixelSettings(store.id, parsed.data);
  } catch (error) {
    logger.error("pixels.save_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save. Try again.");
  }
  revalidatePath("/dashboard/marketing", "layout");
  revalidatePath(`/@${store.slug}`);
  return ok(parsed.data);
}
