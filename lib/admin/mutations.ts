import "server-only";

import { collections } from "@/lib/db/collections";

// Platform admin changes (D-105). Called only from lib/admin/actions.ts after requireAdmin(). None of
// them moves money or touches payments, cards or Better Auth's collections, and nothing is deleted.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pushes the free trial out by `days`, from now or from its current end if that is later. */
export async function extendTrial(storeId: string, days: number, now: Date = new Date()): Promise<Date | null> {
  const { stores } = await collections();
  const store = await stores.findOne({ _id: storeId }, { projection: { trialEndsAt: 1 } });
  if (!store) return null;
  const from = store.trialEndsAt && store.trialEndsAt > now ? store.trialEndsAt : now;
  const until = new Date(from.getTime() + days * DAY_MS);
  await stores.updateOne({ _id: storeId }, { $set: { trialEndsAt: until, updatedAt: now } });
  return until;
}

/** Makes the store a founding creator (free, with Pro) for `months` from now. */
export async function grantFounding(storeId: string, months: number, now: Date = new Date()): Promise<Date | null> {
  const { stores } = await collections();
  const until = new Date(now);
  until.setUTCMonth(until.getUTCMonth() + months);
  const result = await stores.updateOne({ _id: storeId }, { $set: { planTier: "founding", foundingEndsAt: until, updatedAt: now } });
  return result.matchedCount === 1 ? until : null;
}

/** Suspends or restores a store. A suspended store is hidden and cannot sell or publish. */
export async function setStoreSuspended(storeId: string, suspended: boolean, reason: string | null, now: Date = new Date()): Promise<boolean> {
  const { stores } = await collections();
  const result = await stores.updateOne({ _id: storeId }, suspended ? { $set: { suspendedAt: now, suspendReason: reason, updatedAt: now } } : { $set: { suspendedAt: null, suspendReason: null, updatedAt: now } });
  return result.matchedCount === 1;
}

/** Turns a store's broadcasts and welcome emails off or on again. */
export async function setBroadcastsBlocked(storeId: string, blocked: boolean, now: Date = new Date()): Promise<boolean> {
  const { stores } = await collections();
  const result = await stores.updateOne({ _id: storeId }, { $set: { broadcastsBlocked: blocked, updatedAt: now } });
  return result.matchedCount === 1;
}

/** Takes a published product off its store (back to draft). Returns its store id, or null. */
export async function unpublishProductAsAdmin(productId: string, now: Date = new Date()): Promise<string | null> {
  const { products } = await collections();
  const product = await products.findOneAndUpdate({ _id: productId, status: "published" }, { $set: { status: "draft", updatedAt: now } }, { projection: { storeId: 1 } });
  return product?.storeId ?? null;
}
