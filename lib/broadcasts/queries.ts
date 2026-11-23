import "server-only";

import { randomUUID } from "node:crypto";

import { BROADCAST_BATCH_SIZE, type ListEmailInput } from "@/lib/broadcasts/rules";
import { ensureUnsubscribeTokens, listEmailsFor } from "@/lib/broadcasts/delivery";
import { collections, type BroadcastDoc } from "@/lib/db/collections";
import { emailDesignOf } from "@/lib/email/looks";
import { sendListEmails } from "@/lib/email/send";

// Broadcasts (D-095). Creator reads and writes filter by the store id from the verified session
// (CLAUDE.md 6). `sendNextBatch` is the job's step: system code keyed by the broadcast id.

export type BroadcastListItem = Pick<BroadcastDoc, "subject" | "status" | "recipientCount" | "sentCount" | "createdAt" | "finishedAt"> & { id: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** The store's latest broadcasts, newest first. */
export async function listBroadcasts(storeId: string, limit = 30): Promise<BroadcastListItem[]> {
  const { broadcasts } = await collections();
  const docs = await broadcasts.find({ storeId }, { projection: { subject: 1, status: 1, recipientCount: 1, sentCount: 1, createdAt: 1, finishedAt: 1 } }).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs.map((doc) => ({ id: doc._id, subject: doc.subject, status: doc.status, recipientCount: doc.recipientCount, sentCount: doc.sentCount, createdAt: doc.createdAt, finishedAt: doc.finishedAt }));
}

/** Broadcasts the store started in the last 24 hours (for the daily limit). */
export async function countBroadcastsStartedSince(storeId: string, now: Date): Promise<number> {
  const { broadcasts } = await collections();
  return broadcasts.countDocuments({ storeId, startedAt: { $gte: new Date(now.getTime() - DAY_MS) } });
}

/** Saves a broadcast as sending to `recipientCount` people; the job does the rest. */
export async function createSendingBroadcast(storeId: string, input: ListEmailInput, replyTo: string | null, recipientCount: number, now: Date = new Date()): Promise<string> {
  const { broadcasts } = await collections();
  const id = randomUUID();
  await broadcasts.insertOne({ _id: id, storeId, subject: input.subject, body: input.body, replyTo, status: "sending", recipientCount, sentCount: 0, cursor: null, createdAt: now, updatedAt: now, startedAt: now, finishedAt: null });
  return id;
}

/** Marks a broadcast failed (the job gave up, or could not be started). */
export async function markBroadcastFailed(broadcastId: string): Promise<void> {
  const { broadcasts } = await collections();
  const now = new Date();
  await broadcasts.updateOne({ _id: broadcastId, status: "sending" }, { $set: { status: "failed", updatedAt: now, finishedAt: now } });
}

/** A "sending" broadcast with no progress for this long is treated as cut off (D-117). */
export const STUCK_BROADCAST_MS = 60 * 60 * 1000;

/**
 * Marks every broadcast failed that has been "sending" with no progress for an hour (D-117). System
 * code for the cron job, across all stores. Returns how many it marked.
 */
export async function failStuckBroadcasts(now: Date = new Date()): Promise<number> {
  const { broadcasts } = await collections();
  const result = await broadcasts.updateMany(
    { status: "sending", updatedAt: { $lt: new Date(now.getTime() - STUCK_BROADCAST_MS) } },
    { $set: { status: "failed", updatedAt: now, finishedAt: now } },
  );
  return result.modifiedCount;
}

/**
 * Sends the next 100 subscribed people of a sending broadcast (by id order after the saved cursor)
 * and moves the cursor. The Resend idempotency key is the broadcast plus the cursor it started
 * from, so a retry after a cut-off sends nothing twice. Returns whether the broadcast is finished.
 */
export async function sendNextBatch(broadcastId: string): Promise<{ done: boolean; sent: number }> {
  const { broadcasts, stores, subscribers } = await collections();
  const broadcast = await broadcasts.findOne({ _id: broadcastId, status: "sending" });
  if (!broadcast) return { done: true, sent: 0 };
  const store = await stores.findOne({ _id: broadcast.storeId }, { projection: { name: 1, broadcastsBlocked: 1, suspendedAt: 1, emailLook: 1, "theme.accent": 1 } });
  // Blocked or suspended by a platform admin while sending (D-105): stop here.
  if (!store || store.broadcastsBlocked || store.suspendedAt) {
    await markBroadcastFailed(broadcastId);
    return { done: true, sent: 0 };
  }

  const people = await subscribers
    .find({ storeId: broadcast.storeId, status: "subscribed", ...(broadcast.cursor ? { _id: { $gt: broadcast.cursor } } : {}) }, { projection: { email: 1, name: 1, unsubscribeToken: 1 } })
    .sort({ _id: 1 })
    .limit(BROADCAST_BATCH_SIZE)
    .toArray();

  const now = new Date();
  if (people.length === 0) {
    await broadcasts.updateOne({ _id: broadcastId, status: "sending" }, { $set: { status: "sent", updatedAt: now, finishedAt: now } });
    return { done: true, sent: 0 };
  }

  const tokens = await ensureUnsubscribeTokens(broadcast.storeId, people);
  const emails = listEmailsFor({ storeId: broadcast.storeId, storeName: store.name, subject: broadcast.subject, body: broadcast.body, replyTo: broadcast.replyTo, kind: "broadcast", people, tokens, design: emailDesignOf(store) });
  await sendListEmails(emails, `broadcast-${broadcastId}-${broadcast.cursor ?? "start"}`);

  const last = people.at(-1)!._id;
  const done = people.length < BROADCAST_BATCH_SIZE;
  await broadcasts.updateOne(
    { _id: broadcastId, status: "sending", cursor: broadcast.cursor },
    { $set: { cursor: last, updatedAt: now, ...(done ? { status: "sent" as const, finishedAt: now } : {}) }, $inc: { sentCount: emails.length } },
  );
  return { done, sent: emails.length };
}

export type WelcomeEmail = { enabled: boolean; subject: string; body: string };

/** The store's welcome email settings, or null when never saved. */
export async function findWelcomeEmail(storeId: string): Promise<WelcomeEmail | null> {
  const { stores } = await collections();
  const store = await stores.findOne({ _id: storeId }, { projection: { welcomeEmail: 1 } });
  return store?.welcomeEmail ?? null;
}

/** Saves the store's welcome email (already validated). */
export async function saveWelcomeEmail(storeId: string, welcome: WelcomeEmail): Promise<void> {
  const { stores } = await collections();
  await stores.updateOne({ _id: storeId }, { $set: { welcomeEmail: welcome } });
}
