import "server-only";

import { createHash } from "node:crypto";

import { collections } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";

/** Key for a rate-limit bucket. The value is hashed, so emails and IPs are never stored. */
export function rateLimitKey(scope: string, value: string): string {
  return `${scope}:${createHash("sha256").update(value).digest("hex")}`;
}

/**
 * Fixed-window counter in MongoDB: counts this attempt and returns whether it is allowed.
 * One atomic update per call; the TTL index removes old windows.
 */
export async function takeRateLimit(key: string, max: number, windowMinutes: number): Promise<boolean> {
  const { rateLimits } = await collections();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowMinutes * 60_000);
  const active = { $gt: ["$expiresAt", now] };

  const run = () =>
    rateLimits.findOneAndUpdate(
      { _id: key },
      [
        {
          $set: {
            count: { $cond: [active, { $add: ["$count", 1] }, 1] },
            expiresAt: { $cond: [active, "$expiresAt", windowEnd] },
          },
        },
      ],
      { upsert: true, returnDocument: "after" },
    );

  let doc;
  try {
    doc = await run();
  } catch (error) {
    // Two first attempts at the same moment: one insert wins, the other retries as an update.
    if (!isDuplicateKeyError(error)) throw error;
    doc = await run();
  }
  return (doc?.count ?? 1) <= max;
}

/** The count in a rate-limit window without taking an attempt (0 when the window has ended). */
export async function peekRateLimit(key: string, now = new Date()): Promise<number> {
  const { rateLimits } = await collections();
  const doc = await rateLimits.findOne({ _id: key, expiresAt: { $gt: now } }, { projection: { count: 1 } });
  return doc?.count ?? 0;
}

/**
 * Gives back one attempt taken with `takeRateLimit`, for an attempt that did not happen after all
 * (for example a username change that failed because the name was taken). Never goes below zero.
 */
export async function releaseRateLimit(key: string): Promise<void> {
  const { rateLimits } = await collections();
  await rateLimits.updateOne({ _id: key, count: { $gt: 0 } }, { $inc: { count: -1 } });
}
