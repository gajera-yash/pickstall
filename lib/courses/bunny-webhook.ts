import "server-only";

import { z } from "zod";

import { setBunnyVideoStatus } from "@/lib/courses/curriculum";
import { collections } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { logger } from "@/lib/logger";
import { BUNNY_VIDEO_ID, bunnyConfig, statusFromWebhook, verifyWebhookSignature } from "@/lib/video/bunny";

// Bunny Stream webhook (D-055): video encoding status for lesson uploads. Signature checked first
// (HMAC-SHA256 of the raw body with the library's read-only key), then the event id is recorded in
// `webhookEvents` before any work, so a redelivery does nothing (CLAUDE.md 7 rules, applied here).
// Bunny retries on 5xx/408/429 only, so a bad request gets a 4xx and a temporary failure a 500.

const payload = z.object({
  VideoLibraryId: z.union([z.number().int(), z.string().regex(/^\d+$/)]),
  VideoGuid: z.string().regex(BUNNY_VIDEO_ID),
  Status: z.number().int(),
  EventId: z.string().min(1).max(100),
});

export type WebhookResponse = { status: number; body: string };

export async function handleBunnyWebhook(rawBody: Buffer, signature: string | null): Promise<WebhookResponse> {
  const config = bunnyConfig();
  if (!config) return { status: 404, body: "Not configured." };
  if (!verifyWebhookSignature(config, rawBody, signature)) return { status: 401, body: "Bad signature." };

  let json: unknown;
  try {
    json = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return { status: 400, body: "Bad payload." };
  }
  const event = payload.safeParse(json);
  if (!event.success) return { status: 400, body: "Bad payload." };
  // Another library's event (a shared account): nothing of ours to change.
  if (String(event.data.VideoLibraryId) !== config.libraryId) return { status: 200, body: "Ignored." };
  const status = statusFromWebhook(event.data.Status);
  if (!status) return { status: 200, body: "Ignored." };

  const { webhookEvents } = await collections();
  const eventId = `bunny:${event.data.EventId}`;
  try {
    await webhookEvents.insertOne({ _id: eventId, source: "bunny", type: `video.status.${event.data.Status}`, orderId: null, processedAt: new Date() });
  } catch (error) {
    if (isDuplicateKeyError(error)) return { status: 200, body: "Already handled." };
    throw error;
  }

  try {
    await setBunnyVideoStatus(event.data.VideoGuid, status);
  } catch (error) {
    // Let Bunny retry: forget the event so the redelivery is handled.
    await webhookEvents.deleteOne({ _id: eventId }).catch(() => undefined);
    logger.error("courses.bunny_webhook_failed", { name: error instanceof Error ? error.name : undefined });
    return { status: 500, body: "Try again." };
  }
  return { status: 200, body: "OK" };
}
