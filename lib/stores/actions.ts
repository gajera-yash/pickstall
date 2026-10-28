"use server";

import { revalidatePath } from "next/cache";

import { requireCreator } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { err, ok, type Result } from "@/lib/result";
import { updateStoreSetup } from "@/lib/stores/queries";
import { storeSetupInput } from "@/lib/stores/schemas";

export type StoreSetupState = Result<{ savedAt: number }> | null;

const STORE_SETUP_PATH = "/dashboard/store";

/**
 * Saves Store setup (PHASE1_PLAN.md B4). The store is found from the session's user id, never
 * from a form field, so a creator can only ever change their own store.
 */
export async function saveStoreSetup(_prev: StoreSetupState, formData: FormData): Promise<StoreSetupState> {
  const { user } = await requireCreator(STORE_SETUP_PATH);

  const parsed = storeSetupInput.safeParse({
    name: formData.get("name") ?? "",
    bio: formData.get("bio") ?? "",
    avatarUrl: formData.get("avatarUrl") ?? "",
    link: formData.get("link") ?? "",
    currency: formData.get("currency"),
    themePreset: formData.get("themePreset"),
    accent: formData.get("accent") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;
    return err(issue?.message ?? "Check the form and try again.", field);
  }

  try {
    const saved = await updateStoreSetup(user.id, parsed.data);
    if (!saved) return err("We couldn't find your store. Reload the page and try again.");
  } catch (error) {
    logger.error("stores.setup_save_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save your store. Check your connection and try again.");
  }

  revalidatePath("/dashboard", "layout");
  return ok({ savedAt: Date.now() });
}
