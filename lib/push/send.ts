import "server-only";

import { sendNotification, WebPushError } from "web-push";

import { SUPPORT_EMAIL } from "@/lib/config";
import { collections } from "@/lib/db/collections";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";

// Sends browser push notifications for a store (D-132), with the `web-push` library (VAPID signing
// and payload encryption). The payload holds only what the in-app notification shows (title, body
// and a dashboard path); never buyer emails. A browser the push service says is gone is removed.

export type PushMessage = { title: string; body: string; href: string };

const TIMEOUT_MS = 4_000;

export function pushConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY && serverEnv.VAPID_PRIVATE_KEY);
}

/** Only dashboard paths open from a notification. */
export function safePushHref(href: string): string {
  return href.startsWith("/dashboard") && !href.startsWith("//") ? href : "/dashboard";
}

export async function sendPushToStore(storeId: string, message: PushMessage, now: Date = new Date()): Promise<number> {
  if (!pushConfigured()) return 0;
  const { pushSubscriptions } = await collections();
  const targets = await pushSubscriptions.find({ storeId }).limit(10).toArray();
  if (targets.length === 0) return 0;
  const payload = JSON.stringify({ title: message.title.slice(0, 120), body: message.body.slice(0, 240), href: safePushHref(message.href) });
  const vapidDetails = { subject: `mailto:${SUPPORT_EMAIL}`, publicKey: publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string, privateKey: serverEnv.VAPID_PRIVATE_KEY as string };

  let sent = 0;
  await Promise.all(
    targets.map(async (target) => {
      try {
        await sendNotification({ endpoint: target.endpoint, keys: target.keys }, payload, { vapidDetails, TTL: 60 * 60, urgency: "high", timeout: TIMEOUT_MS });
        sent += 1;
        await pushSubscriptions.updateOne({ _id: target._id }, { $set: { lastSentAt: now } });
      } catch (error) {
        // 404 / 410: the browser unsubscribed or the subscription expired.
        if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
          await pushSubscriptions.deleteOne({ _id: target._id, storeId });
          return;
        }
        logger.warn("push.send_failed", { status: error instanceof WebPushError ? error.statusCode : undefined });
      }
    }),
  );
  return sent;
}
