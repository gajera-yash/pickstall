import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import { collections } from "@/lib/db/collections";

// Browser push subscriptions (D-132). Saved for the session's user and store; read only by the
// sender for that store. The endpoint is a push-service URL the browser gave us.

export const pushSubscriptionInput = z.object({
  endpoint: z.url().max(1000).refine((value) => value.startsWith("https://"), { error: "Push endpoints are https." }),
  keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{40,120}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{10,40}$/) }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInput>;

/** At most this many browsers per store get pushes (old ones are dropped first). */
export const PUSH_MAX_PER_STORE = 10;

export const endpointId = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");

export async function savePushSubscription(userId: string, storeId: string, input: PushSubscriptionInput, now: Date = new Date()): Promise<void> {
  const { pushSubscriptions } = await collections();
  await pushSubscriptions.updateOne(
    { _id: endpointId(input.endpoint) },
    { $set: { userId, storeId, endpoint: input.endpoint, keys: input.keys }, $setOnInsert: { createdAt: now, lastSentAt: null } },
    { upsert: true },
  );
  // Keep the newest few: a creator who reinstalled browsers many times does not get pushes to dead ones.
  const extra = await pushSubscriptions.find({ storeId }, { projection: { _id: 1 } }).sort({ createdAt: -1 }).skip(PUSH_MAX_PER_STORE).toArray();
  if (extra.length > 0) await pushSubscriptions.deleteMany({ _id: { $in: extra.map((doc) => doc._id) }, storeId });
}

/** Removes this browser for this user (turning notifications off). */
export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  const { pushSubscriptions } = await collections();
  await pushSubscriptions.deleteOne({ _id: endpointId(endpoint), userId });
}
