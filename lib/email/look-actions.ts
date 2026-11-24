"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCreator } from "@/lib/auth/guards";
import { EMAIL_LOOKS } from "@/lib/email/looks";
import { logger } from "@/lib/logger";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import { updateEmailLook } from "@/lib/stores/queries";

const PATH = "/dashboard/marketing";

/** Saves the look of every email the creator writes (D-124), on the session owner's store. */
export async function saveEmailLookAction(raw: unknown): Promise<Result<{ saved: true }>> {
  const { user } = await requireCreator(PATH);
  const parsed = z.enum(EMAIL_LOOKS).safeParse(raw);
  if (!parsed.success) return err("Pick an email design.");
  if (!(await takeRateLimit(rateLimitKey("email-look:owner", user.id), 30, 10))) return err("Slow down a little, then try again.");
  try {
    if (!(await updateEmailLook(user.id, parsed.data))) return err("We couldn't find your store.");
  } catch (error) {
    logger.error("email_look.save_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save. Try again.");
  }
  revalidatePath(PATH);
  return ok({ saved: true });
}
