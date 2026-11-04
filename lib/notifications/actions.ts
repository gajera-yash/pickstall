"use server";

import { requireCreator } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { listNotifications, markAllRead, type NotificationItem } from "@/lib/notifications/queries";
import { err, ok, type Result } from "@/lib/result";

// The dashboard bell (D-061): read and mark read the signed-in creator's own notifications. The
// store always comes from the session.

export async function getNotifications(): Promise<Result<{ items: NotificationItem[]; unread: number }>> {
  const { store } = await requireCreator("/dashboard");
  try {
    return ok(await listNotifications(store.id));
  } catch (error) {
    logger.warn("notifications.read_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't load notifications.");
  }
}

export async function markNotificationsRead(): Promise<Result<{ done: true }>> {
  const { store } = await requireCreator("/dashboard");
  try {
    await markAllRead(store.id);
    return ok({ done: true });
  } catch (error) {
    logger.warn("notifications.mark_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't update notifications.");
  }
}
