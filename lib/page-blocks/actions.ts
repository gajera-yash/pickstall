"use server";

import { revalidatePath } from "next/cache";

import { requireCreator } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { savePageBlocks } from "@/lib/page-blocks/queries";
import { pageBlocksInput, type PageBlock } from "@/lib/page-blocks/rules";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

/** Saves the store page sections of the session owner's store (D-101). Everything is checked again here. */
export async function savePageBlocksAction(raw: unknown): Promise<Result<{ blocks: PageBlock[] }>> {
  const { user, store } = await requireCreator("/dashboard");
  const parsed = pageBlocksInput.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const index = typeof issue?.path[0] === "number" ? issue.path[0] : null;
    return err(issue?.message ?? "Check your sections and try again.", index !== null ? `block-${index}` : undefined);
  }
  if (!(await takeRateLimit(rateLimitKey("page-blocks:owner", user.id), 30, 10))) return err("Slow down a little, then try again.");
  try {
    await savePageBlocks(store.id, parsed.data);
  } catch (error) {
    logger.error("page_blocks.save_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save. Try again.");
  }
  revalidatePath("/dashboard");
  revalidatePath(`/@${store.slug}`);
  return ok({ blocks: parsed.data });
}
