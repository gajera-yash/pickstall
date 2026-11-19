"use server";

import { revalidatePath } from "next/cache";

import { requireCreator } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import { subscriberLimit } from "@/lib/plans/access";
import { importConsentText, importPayload } from "@/lib/subscribers/import-rules";
import { countSubscribed, deleteSubscriber, importSubscribers, unsubscribeSubscriber, type ImportResult } from "@/lib/subscribers/queries";

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

export type ImportSubscribersResult = Result<ImportResult>;

/**
 * Imports people from a CSV (D-100). The browser sends only the mapped email and name of each row;
 * every row is checked again here. The creator must confirm the people agreed to their emails; that
 * confirmation, the file name and the date are saved as each person's consent. The plan's subscriber
 * limit caps how many are added.
 */
export async function importSubscribersAction(raw: unknown): Promise<ImportSubscribersResult> {
  const { user, store } = await requireCreator(PATH);
  const parsed = importPayload.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the file and try again.");
  if (!(await takeRateLimit(rateLimitKey("subscriber-import:owner", user.id), 10, 60))) return err("You have imported a lot. Try again in a little while.");
  try {
    const now = new Date();
    const fileName = parsed.data.fileName.trim() || "a CSV file";
    const room = subscriberLimit(store.access) - (await countSubscribed(store.id));
    const result = await importSubscribers(store.id, parsed.data.rows, { consentText: importConsentText(fileName, now), fileName: fileName.slice(0, 120), room, now });
    revalidatePath(PATH);
    return ok(result);
  } catch (error) {
    logger.error("subscribers.import_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't import. Try again.");
  }
}
