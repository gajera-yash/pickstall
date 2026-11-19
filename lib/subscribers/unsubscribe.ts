import "server-only";

import { collections, type SubscriberDoc } from "@/lib/db/collections";

// Unsubscribe links (D-095). The token alone identifies the person; it is random and only ever in
// that person's emails. Nothing here shows their email address.

const TOKEN = /^[A-Za-z0-9_-]{32}$/;

export function isUnsubscribeToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN.test(value);
}

/** The store name and whether this link's person is still subscribed, or null for an unknown link. */
export async function findByUnsubscribeToken(token: string): Promise<{ storeName: string; subscribed: boolean } | null> {
  if (!isUnsubscribeToken(token)) return null;
  const { subscribers, stores } = await collections();
  const person = await subscribers.findOne({ unsubscribeToken: token }, { projection: { storeId: 1, status: 1 } });
  if (!person) return null;
  const store = await stores.findOne({ _id: person.storeId }, { projection: { name: 1 } });
  return { storeName: store?.name ?? "this creator", subscribed: person.status === "subscribed" };
}

/** Unsubscribes the person of this link. Idempotent; false for an unknown link. */
export async function unsubscribeByToken(token: string, reason: NonNullable<SubscriberDoc["unsubscribeReason"]> = "user"): Promise<boolean> {
  if (!isUnsubscribeToken(token)) return false;
  const { subscribers } = await collections();
  const now = new Date();
  const person = await subscribers.findOne({ unsubscribeToken: token }, { projection: { status: 1 } });
  if (!person) return false;
  if (person.status === "subscribed") {
    await subscribers.updateOne({ _id: person._id, status: "subscribed" }, { $set: { status: "unsubscribed", unsubscribedAt: now, unsubscribeReason: reason, updatedAt: now } });
  }
  return true;
}

/** A bounce or spam complaint from Resend's webhook: the person leaves that store's list. */
export async function unsubscribeFromWebhook(storeId: string, subscriberId: string, reason: "bounced" | "complained"): Promise<boolean> {
  const { subscribers } = await collections();
  const now = new Date();
  const result = await subscribers.updateOne({ _id: subscriberId, storeId, status: "subscribed" }, { $set: { status: "unsubscribed", unsubscribedAt: now, unsubscribeReason: reason, updatedAt: now } });
  return result.modifiedCount === 1;
}
