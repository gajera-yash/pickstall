"use server";

import { revalidatePath } from "next/cache";

import { requireCreator } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import { designContrastProblem, storeDesignInput } from "@/lib/store-design/rules";
import { updateStoreDesign } from "@/lib/stores/queries";
import { THEME_PRESETS } from "@/lib/themes";

const PATH = "/dashboard";

/**
 * Saves the custom design (D-123) of the session owner's store, or resets it to the theme with
 * `null`. Checked again here: fixed options, #RRGGBB colors, images from uploads or https, and the
 * text contrast on the store's current theme and accent.
 */
export async function saveStoreDesignAction(raw: unknown): Promise<Result<{ saved: true }>> {
  const { user, store } = await requireCreator(PATH);
  if (!(await takeRateLimit(rateLimitKey("store-design:owner", user.id), 60, 10))) return err("Slow down a little, then try again.");

  let design = null;
  if (raw !== null) {
    const parsed = storeDesignInput.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return err(issue?.message ?? "Check your design and try again.", issue?.path.join(".") || undefined);
    }
    const preset = THEME_PRESETS[store.theme.preset] ?? THEME_PRESETS.clean;
    const problem = designContrastProblem(preset, store.theme.accent, parsed.data);
    if (problem) return err(problem.message, problem.field);
    design = parsed.data;
  }

  try {
    if (!(await updateStoreDesign(user.id, design))) return err("We couldn't find your store.");
  } catch (error) {
    logger.error("store_design.save_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save. Try again.");
  }
  revalidatePath(PATH, "layout");
  return ok({ saved: true });
}
