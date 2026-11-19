import "server-only";

import { randomUUID } from "node:crypto";

import { after } from "next/server";

import { collections, type SubscriberDoc } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { escapeRegex } from "@/lib/orders/csv";
import { cleanImportRow } from "@/lib/subscribers/import-rules";
import { emailKeyOf, type SubscriberRow } from "@/lib/subscribers/rules";
import { newUnsubscribeToken } from "@/lib/subscribers/token";
import { sendWelcomeEmail } from "@/lib/subscribers/welcome";

// The creator's email list (D-094). Creator reads and writes filter by the store id from the
// verified session (requireCreator), never from the request (CLAUDE.md 6). Only the paid-order
// step adds people, and only with the consent saved on the order.

export const SUBSCRIBER_PAGE_SIZE = 25;
/** Most rows one CSV export holds. */
export const SUBSCRIBER_EXPORT_MAX = 50_000;

export type SubscriberListItem = { id: string; email: string; name: string | null; status: SubscriberDoc["status"]; sourceTitle: string; sourceKind: SubscriberDoc["source"]["kind"]; joinedAt: Date };
export type SubscriberPage = { items: SubscriberListItem[]; nextBefore: string | null };

const toItem = (doc: SubscriberDoc): SubscriberListItem => ({
  id: doc._id,
  email: doc.email,
  name: doc.name,
  status: doc.status,
  sourceTitle: doc.source.productTitle,
  sourceKind: doc.source.kind,
  joinedAt: doc.createdAt,
});

/**
 * Adds (or re-subscribes) the buyer of a paid order when the order carries their consent. Runs in
 * the paid-order step, so it must be idempotent: the same order twice leaves one subscriber.
 * Returns whether someone is on the list for it.
 */
export async function addSubscriberForOrder(orderId: string): Promise<boolean> {
  const { orders, products, subscribers } = await collections();
  const order = await orders.findOne({ _id: orderId, status: "paid" }, { projection: { storeId: 1, productId: 1, buyerEmail: 1, buyerName: 1, marketingConsent: 1, item: 1 } });
  if (!order?.marketingConsent) return false;
  const product = await products.findOne({ _id: order.productId, storeId: order.storeId }, { projection: { type: 1, title: 1 } });
  const now = new Date();
  const emailKey = emailKeyOf(order.buyerEmail);
  const update = {
    $setOnInsert: {
      _id: randomUUID(),
      email: order.buyerEmail.trim(),
      name: order.buyerName.trim() || null,
      unsubscribeToken: newUnsubscribeToken(),
      source: { kind: product?.type === "lead_magnet" ? ("lead_magnet" as const) : ("purchase" as const), productId: order.productId, productTitle: product?.title ?? order.item.title },
      createdAt: now,
    },
    $set: { status: "subscribed" as const, consent: order.marketingConsent, unsubscribedAt: null, unsubscribeReason: null, updatedAt: now },
  };
  try {
    await subscribers.updateOne({ storeId: order.storeId, emailKey }, update, { upsert: true });
  } catch (error) {
    // Two paid orders of one email at the same moment: the other upsert inserted first.
    if (!isDuplicateKeyError(error)) throw error;
    await subscribers.updateOne({ storeId: order.storeId, emailKey }, { $set: update.$set });
  }
  // The welcome email (D-095), once per person, after the response: it never slows the sale.
  const person = await subscribers.findOne({ storeId: order.storeId, emailKey }, { projection: { _id: 1, welcomedAt: 1 } });
  if (person && !person.welcomedAt) {
    const storeId = order.storeId;
    after(() => sendWelcomeEmail(storeId, person._id));
  }
  return true;
}

function listFilter(storeId: string, options: { q?: string; status?: SubscriberDoc["status"] }) {
  const q = options.q?.trim().slice(0, 100);
  return {
    storeId,
    ...(options.status ? { status: options.status } : {}),
    ...(q ? { $or: [{ emailKey: { $regex: escapeRegex(q.toLowerCase()) } }, { name: { $regex: escapeRegex(q), $options: "i" } }] } : {}),
  };
}

/** One page of the store's list, newest first. `before` is the previous page's last join time. */
export async function listSubscribers(storeId: string, options: { q?: string; status?: SubscriberDoc["status"]; before?: Date; limit?: number } = {}): Promise<SubscriberPage> {
  const { subscribers } = await collections();
  const limit = options.limit ?? SUBSCRIBER_PAGE_SIZE;
  const filter = { ...listFilter(storeId, options), ...(options.before ? { createdAt: { $lt: options.before } } : {}) };
  const docs = await subscribers.find(filter).sort({ createdAt: -1 }).limit(limit + 1).toArray();
  const page = docs.slice(0, limit);
  return { items: page.map(toItem), nextBefore: docs.length > limit ? (page.at(-1)?.createdAt.toISOString() ?? null) : null };
}

/** How many people are subscribed (unsubscribed ones do not count towards the plan limit). */
export async function countSubscribed(storeId: string): Promise<number> {
  const { subscribers } = await collections();
  return subscribers.countDocuments({ storeId, status: "subscribed" });
}

/** Everyone on the list for the CSV export, newest first. */
export async function listSubscribersForExport(storeId: string): Promise<SubscriberRow[]> {
  const { subscribers } = await collections();
  const docs = await subscribers.find({ storeId }).sort({ createdAt: -1 }).limit(SUBSCRIBER_EXPORT_MAX).toArray();
  return docs.map((doc) => ({ email: doc.email, name: doc.name, status: doc.status, sourceTitle: doc.source.productTitle, joinedAt: doc.createdAt }));
}

/** Marks one of the store's subscribers unsubscribed. False when it is not this store's. */
export async function unsubscribeSubscriber(storeId: string, id: string): Promise<boolean> {
  const { subscribers } = await collections();
  const now = new Date();
  const result = await subscribers.updateOne({ _id: id, storeId }, { $set: { status: "unsubscribed", unsubscribedAt: now, unsubscribeReason: "creator", updatedAt: now } });
  return result.matchedCount === 1;
}

/** Deletes one of the store's subscribers (a data request). False when it is not this store's. */
export async function deleteSubscriber(storeId: string, id: string): Promise<boolean> {
  const { subscribers } = await collections();
  const result = await subscribers.deleteOne({ _id: id, storeId });
  return result.deletedCount === 1;
}

export type ImportResult = { added: number; existing: number; invalid: number; overLimit: number };

/**
 * Adds imported people to the store's list (D-100). Valid, new emails only: someone already on the
 * list (subscribed or not) is left exactly as they are, so an unsubscribe is never undone. No more
 * than `room` people are added (the plan's subscriber limit). No welcome email is sent.
 */
export async function importSubscribers(
  storeId: string,
  rows: { email: unknown; name: unknown }[],
  options: { consentText: string; fileName: string; room: number; now?: Date },
): Promise<ImportResult> {
  const { subscribers } = await collections();
  const now = options.now ?? new Date();
  const seen = new Set<string>();
  const valid: { email: string; name: string | null; emailKey: string }[] = [];
  let invalid = 0;
  for (const raw of rows) {
    const row = cleanImportRow(raw);
    if (!row) {
      invalid += 1;
      continue;
    }
    const emailKey = emailKeyOf(row.email);
    if (seen.has(emailKey)) continue;
    seen.add(emailKey);
    valid.push({ ...row, emailKey });
  }

  // People already on the list are not added again (and do not use up room).
  const existingKeys = new Set<string>();
  for (let i = 0; i < valid.length; i += 1000) {
    const keys = valid.slice(i, i + 1000).map((row) => row.emailKey);
    const found = await subscribers.find({ storeId, emailKey: { $in: keys } }, { projection: { emailKey: 1 } }).toArray();
    for (const doc of found) existingKeys.add(doc.emailKey);
  }
  const fresh = valid.filter((row) => !existingKeys.has(row.emailKey));
  const room = Math.max(0, options.room);
  const toAdd = fresh.slice(0, room);

  let added = 0;
  for (let i = 0; i < toAdd.length; i += 500) {
    const batch = toAdd.slice(i, i + 500);
    const result = await subscribers.bulkWrite(
      batch.map((row) => ({
        updateOne: {
          // $setOnInsert only: if the email joined meanwhile, nothing about them changes.
          filter: { storeId, emailKey: row.emailKey },
          update: {
            $setOnInsert: {
              _id: randomUUID(),
              storeId,
              emailKey: row.emailKey,
              email: row.email,
              name: row.name,
              status: "subscribed" as const,
              source: { kind: "import" as const, productId: "", productTitle: options.fileName },
              consent: { at: now, text: options.consentText },
              unsubscribedAt: null,
              unsubscribeReason: null,
              unsubscribeToken: newUnsubscribeToken(),
              createdAt: now,
              updatedAt: now,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    added += result.upsertedCount;
  }
  return { added, existing: existingKeys.size + (toAdd.length - added), invalid, overLimit: fresh.length - toAdd.length };
}
