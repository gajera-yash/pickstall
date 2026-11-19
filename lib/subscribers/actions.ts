"use server";

import { revalidatePath } from "next/cache";

import { requireCreator } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import { deleteSubscriber, unsubscribeSubscriber } from "@/lib/subscribers/queries";

// Changes to the creator's email list (D-094). The store always comes from the session.

const PATH = "/dashboard/marketing/subscribers";
const NOT_FOUND = "We couldn't find that subscriber.";

async function change(subscriberId: unknown, run: (storeId: string, id: string) => Promise<boolean>): Promise<Result<{ done: true }>> {
  const { user, store } = await requireCreator(PATH);
  if (typeof subscriberId !== "string" || !isUuid(subscriberId)) return err(NOT_FOUND);
  if (!(await takeRateLimit(rateLimitKey("subscriber-write:owner", user.id), 60, 10))) return err("Slow down a little, then try again.");
  try {
    if (!(await run(store.id, subscriberId))) return err(NOT_FOUND);
  } catch (error) {
    logger.error("subscribers.change_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save. Try again.");
  }
  revalidatePath(PATH);
  return ok({ done: true });
}

/** Marks a subscriber of the session owner's store unsubscribed. */
export async function unsubscribeSubscriberAction(subscriberId: string): Promise<Result<{ done: true }>> {
  return change(subscriberId, unsubscribeSubscriber);
}

/** Deletes a subscriber of the session owner's store (for a data request). */
export async function deleteSubscriberAction(subscriberId: string): Promise<Result<{ done: true }>> {
  return change(subscriberId, deleteSubscriber);
}
