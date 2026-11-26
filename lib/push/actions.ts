"use server";

import { requireCreator } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { deletePushSubscription, pushSubscriptionInput, savePushSubscription } from "@/lib/push/queries";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

// Turning browser notifications on or off (D-132) for the signed-in creator's store.

export async function savePushSubscriptionAction(raw: unknown): Promise<Result<{ saved: true }>> {
  const { user, store } = await requireCreator("/dashboard");
  const parsed = pushSubscriptionInput.safeParse(raw);
  if (!parsed.success) return err("This browser sent something we can't use.");
  if (!(await takeRateLimit(rateLimitKey("push-subscribe:user", user.id), 20, 60))) return err("Slow down a little, then try again.");
  try {
    await savePushSubscription(user.id, store.id, parsed.data);
  } catch (error) {
    logger.warn("push.subscribe_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't turn notifications on. Try again.");
  }
  return ok({ saved: true });
}

export async function deletePushSubscriptionAction(endpoint: unknown): Promise<Result<{ deleted: true }>> {
  const { user } = await requireCreator("/dashboard");
  if (typeof endpoint !== "string" || endpoint.length > 1000) return err("Unknown browser.");
  try {
    await deletePushSubscription(user.id, endpoint);
  } catch (error) {
    logger.warn("push.unsubscribe_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't turn notifications off. Try again.");
  }
  return ok({ deleted: true });
}
