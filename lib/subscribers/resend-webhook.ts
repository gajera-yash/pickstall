import "server-only";

import { Resend } from "resend";

import { collections } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { unsubscribeFromWebhook } from "@/lib/subscribers/unsubscribe";

// Resend's webhook (D-095): a permanent bounce or a spam complaint on a list email removes that
// person from that store's list, so the shared sending domain keeps a good name. The signature is
// checked with the endpoint's signing secret; each delivery id is handled once.

export type ResendWebhookResult = { status: number; body: string };

type Tagged = { type: string; data?: { tags?: Record<string, string>; bounce?: { type?: string } } };

/** What a verified event asks for, or null when it changes nothing. Pure, for the tests. */
export function listActionFor(event: Tagged): { storeId: string; subscriberId: string; reason: "bounced" | "complained" } | null {
  const tags = event.data?.tags ?? {};
  if (tags.kind !== "broadcast" && tags.kind !== "welcome") return null;
  const storeId = tags.store_id;
  const subscriberId = tags.subscriber_id;
  if (!storeId || !subscriberId || !isUuid(storeId) || !isUuid(subscriberId)) return null;
  if (event.type === "email.complained") return { storeId, subscriberId, reason: "complained" };
  // Only a permanent bounce: a full inbox or a passing outage is not a reason to drop someone.
  if (event.type === "email.bounced" && event.data?.bounce?.type?.toLowerCase() === "permanent") return { storeId, subscriberId, reason: "bounced" };
  return null;
}

export async function handleResendWebhook(payload: string, headers: { id: string | null; timestamp: string | null; signature: string | null }): Promise<ResendWebhookResult> {
  const secret = serverEnv.RESEND_WEBHOOK_SECRET;
  if (!secret) return { status: 503, body: "Not configured." };
  if (!headers.id || !headers.timestamp || !headers.signature) return { status: 400, body: "Missing signature." };

  let event: Tagged;
  try {
    // The API key is not used to verify; the SDK only needs one to be constructed.
    event = new Resend(serverEnv.RESEND_API_KEY ?? "re_verify_only").webhooks.verify({ payload, headers: { id: headers.id, timestamp: headers.timestamp, signature: headers.signature }, webhookSecret: secret }) as Tagged;
  } catch {
    return { status: 400, body: "Bad signature." };
  }

  const { webhookEvents } = await collections();
  const key = `resend:${headers.id}`;
  try {
    await webhookEvents.insertOne({ _id: key, source: "resend", type: event.type, orderId: null, processedAt: new Date() });
  } catch (error) {
    if (isDuplicateKeyError(error)) return { status: 200, body: "ok" };
    throw error;
  }

  try {
    const action = listActionFor(event);
    if (action) await unsubscribeFromWebhook(action.storeId, action.subscriberId, action.reason);
    return { status: 200, body: "ok" };
  } catch (error) {
    // Forget the delivery so Resend's retry is handled.
    await webhookEvents.deleteOne({ _id: key }).catch(() => undefined);
    logger.error("webhook.resend_failed", { name: error instanceof Error ? error.name : undefined });
    return { status: 500, body: "error" };
  }
}
