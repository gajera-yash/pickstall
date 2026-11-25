"use server";

import { requireUser } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import { TOUR_IDS, isSeenId } from "@/lib/tours/catalog";
import { markTourSeen, resetTours } from "@/lib/tours/queries";

// Tour progress (D-128) for the signed-in user. Nothing here changes a store; ids must be known.

export async function markTourSeenAction(id: unknown): Promise<Result<{ done: true }>> {
  if (!isSeenId(id)) return err("Unknown tour.");
  const user = await requireUser("/dashboard");
  if (!(await takeRateLimit(rateLimitKey("tour:user", user.id), 120, 10))) return err("Slow down a little.");
  try {
    await markTourSeen(user.id, id);
  } catch (error) {
    logger.warn("tours.mark_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save.");
  }
  return ok({ done: true });
}

export async function resetToursAction(): Promise<Result<{ done: true }>> {
  const user = await requireUser("/dashboard");
  if (!(await takeRateLimit(rateLimitKey("tour-reset:user", user.id), 20, 10))) return err("Slow down a little.");
  try {
    await resetTours(user.id, TOUR_IDS);
  } catch (error) {
    logger.warn("tours.reset_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't reset the tours.");
  }
  return ok({ done: true });
}
