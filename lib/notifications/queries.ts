import "server-only";

import { randomUUID } from "node:crypto";

import { collections, type NotificationDoc } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { logger } from "@/lib/logger";
import { sendPushToStore } from "@/lib/push/send";
import { formatMoney } from "@/lib/products/money";

// Dashboard notifications (D-061). Written by the payment flow and the video status updates, read
// by the bell in the dashboard. Writes are idempotent by `dedupeKey`; a failed write is only logged,
// it never affects the payment or the upload that caused it. Reads filter by the session's store.

export type NotificationItem = Pick<NotificationDoc, "kind" | "title" | "body" | "href" | "test"> & { id: string; createdAt: string; read: boolean };

const LIST_LIMIT = 20;

type NewNotification = Omit<NotificationDoc, "_id" | "createdAt" | "readAt" | "amountCents" | "currency" | "test"> &
  Partial<Pick<NotificationDoc, "amountCents" | "currency" | "test">>;

/** Adds a notification once per `dedupeKey`. Never throws. */
export async function notify(input: NewNotification): Promise<void> {
  try {
    const { notifications } = await collections();
    await notifications.insertOne({ amountCents: null, currency: null, test: false, ...input, _id: randomUUID(), createdAt: new Date(), readAt: null });
  } catch (error) {
    if (isDuplicateKeyError(error)) return; // already notified (a replayed event): no second push either
    logger.warn("notifications.write_failed", { name: error instanceof Error ? error.name : undefined });
    return;
  }
  // The same notification in the creator's browsers (D-132). A push problem never breaks the sale.
  await sendPushToStore(input.storeId, { title: input.title, body: input.body, href: input.href }).catch((error: unknown) =>
    logger.warn("push.store_send_failed", { name: error instanceof Error ? error.name : undefined }),
  );
}

/** "New sale" for an order that just became paid (free orders: "New sign-up"). */
export async function notifyOrderPaid(orderId: string): Promise<void> {
  try {
    const { orders } = await collections();
    const order = await orders.findOne({ _id: orderId, status: "paid" }, { projection: { storeId: 1, buyerName: 1, item: 1, totalCents: 1, currency: 1, provider: 1 } });
    if (!order) return;
    const free = order.totalCents === 0;
    await notify({
      storeId: order.storeId,
      kind: "sale",
      dedupeKey: `sale:${orderId}`,
      title: free ? "New sign-up" : `New sale: ${formatMoney(order.totalCents, order.currency)}`,
      body: `${order.buyerName} ${free ? "got" : "bought"} ${order.item.title}`,
      href: `/dashboard/orders?order=${orderId}`,
      amountCents: order.totalCents,
      currency: order.currency,
      test: order.provider === "mock",
    });
  } catch (error) {
    logger.warn("notifications.sale_failed", { name: error instanceof Error ? error.name : undefined });
  }
}

/** "Refund" for an order whose refunded amount just grew (full or partial). */
export async function notifyRefund(orderId: string, refundedCents: number, full: boolean): Promise<void> {
  try {
    const { orders } = await collections();
    const order = await orders.findOne({ _id: orderId }, { projection: { storeId: 1, buyerName: 1, item: 1, currency: 1, provider: 1 } });
    if (!order) return;
    await notify({
      storeId: order.storeId,
      kind: "refund",
      dedupeKey: `refund:${orderId}:${refundedCents}`,
      title: `${full ? "Refunded" : "Partly refunded"}: ${formatMoney(refundedCents, order.currency)}`,
      body: `${order.buyerName}, ${order.item.title}`,
      href: `/dashboard/orders?order=${orderId}`,
      amountCents: refundedCents,
      currency: order.currency,
      test: order.provider === "mock",
    });
  } catch (error) {
    logger.warn("notifications.refund_failed", { name: error instanceof Error ? error.name : undefined });
  }
}

/** The store's latest notifications and how many are unread. */
export async function listNotifications(storeId: string): Promise<{ items: NotificationItem[]; unread: number }> {
  const { notifications } = await collections();
  const [docs, unread] = await Promise.all([
    notifications.find({ storeId }).sort({ createdAt: -1 }).limit(LIST_LIMIT).toArray(),
    notifications.countDocuments({ storeId, readAt: null }),
  ]);
  return {
    items: docs.map((doc) => ({ id: doc._id, kind: doc.kind, title: doc.title, body: doc.body, href: doc.href, test: doc.test, createdAt: doc.createdAt.toISOString(), read: doc.readAt !== null })),
    unread,
  };
}

/** Marks all of the store's notifications read. */
export async function markAllRead(storeId: string): Promise<void> {
  const { notifications } = await collections();
  await notifications.updateMany({ storeId, readAt: null }, { $set: { readAt: new Date() } });
}
