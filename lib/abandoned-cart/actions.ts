"use server";

import { revalidatePath } from "next/cache";

import { saveCartSettings } from "@/lib/abandoned-cart/queries";
import { cartSettingsInput } from "@/lib/abandoned-cart/rules";
import { requireCreator } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { AUTOMATIONS_PRO, can } from "@/lib/plans/access";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

const PATH = "/dashboard/marketing";

/** Saves the abandoned cart reminder settings of the session owner's store (D-096). */
export async function saveCartSettingsAction(raw: unknown): Promise<Result<{ enabled: boolean }>> {
  const { user, store } = await requireCreator(PATH);
  const parsed = cartSettingsInput.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return err(issue?.message ?? "Check the reminder and try again.", typeof field === "string" ? field : undefined);
  }
  // A Pro feature (D-098): it can always be saved off, only turned on with the plan.
  if (parsed.data.enabled && !can(store.access, "automations")) return err(AUTOMATIONS_PRO);
  if (!(await takeRateLimit(rateLimitKey("cart-settings:owner", user.id), 30, 10))) return err("Slow down a little, then try again.");
  try {
    await saveCartSettings(store.id, parsed.data);
  } catch (error) {
    logger.error("abandoned_cart.save_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save. Try again.");
  }
  revalidatePath(PATH);
  return ok({ enabled: parsed.data.enabled });
}
