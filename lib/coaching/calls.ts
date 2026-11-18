import "server-only";

import { after } from "next/server";

import { formatCallTime } from "@/lib/coaching/ics";
import { collections, type BookingDoc, type OrderDoc } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { sendEmail } from "@/lib/email/send";
import { renderCallCancelled } from "@/lib/email/templates";
import { logger } from "@/lib/logger";

// The creator's coaching calls (D-086). Every query starts from the `storeId` of requireCreator(),
// never from client input; buyers' details are shown only to the store that sold the call.

export type CallRow = {
  orderId: string;
  start: Date;
  end: Date;
  status: BookingDoc["status"];
  productTitle: string;
  buyerName: string;
  buyerEmail: string;
  orderStatus: OrderDoc["status"];
  /** The coach's time zone (the product's), for showing the time. */
  timeZone: string | null;
};

/** Calls still ahead (confirmed), plus every "conflict" that needs the creator, soonest first. */
export async function listUpcomingCalls(storeId: string, now: Date = new Date(), limit = 20): Promise<CallRow[]> {
  const { bookings, orders, products } = await collections();
  const rows = await bookings
    .find({ storeId, $or: [{ status: "confirmed", end: { $gt: now } }, { status: "conflict" }] }, { projection: { orderId: 1, productId: 1, start: 1, end: 1, status: 1 } })
    .sort({ start: 1 })
    .limit(limit)
    .toArray();
  if (rows.length === 0) return [];
  const [orderDocs, productDocs] = await Promise.all([
    orders.find({ storeId, _id: { $in: rows.map((row) => row.orderId) } }, { projection: { buyerName: 1, buyerEmail: 1, item: 1, status: 1 } }).toArray(),
    products.find({ storeId, _id: { $in: [...new Set(rows.map((row) => row.productId))] } }, { projection: { "coaching.timeZone": 1 } }).toArray(),
  ]);
  const orderById = new Map(orderDocs.map((doc) => [doc._id, doc]));
  const zoneByProduct = new Map(productDocs.map((doc) => [doc._id, doc.coaching?.timeZone ?? null]));
  return rows.flatMap((row) => {
    const order = orderById.get(row.orderId);
    if (!order) return [];
    return [
      {
        orderId: row.orderId,
        start: row.start,
        end: row.end,
        status: row.status,
        productTitle: order.item.title,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        orderStatus: order.status,
        timeZone: zoneByProduct.get(row.productId) ?? null,
      },
    ];
  });
}

export type OrderCall = { start: Date; end: Date; status: BookingDoc["status"]; timeZone: string | null };

/** The call of one order of this store, for the order drawer, or null. */
export async function findOrderCall(storeId: string, orderId: string): Promise<OrderCall | null> {
  const { bookings, products } = await collections();
  const booking = await bookings.findOne({ orderId, storeId }, { projection: { start: 1, end: 1, status: 1, productId: 1 } });
  if (!booking) return null;
  const product = await products.findOne({ _id: booking.productId, storeId }, { projection: { "coaching.timeZone": 1 } });
  return { start: booking.start, end: booking.end, status: booking.status, timeZone: product?.coaching?.timeZone ?? null };
}

const CANCELLABLE: BookingDoc["status"][] = ["held", "confirmed", "conflict"];

/**
 * Cancels a call of this store: it gives its time back and gets no reminders (they check the
 * booking first). True when this call changed it.
 */
export async function cancelBooking(storeId: string, orderId: string, now: Date = new Date()): Promise<boolean> {
  const { bookings } = await collections();
  const result = await bookings.updateOne(
    { orderId, storeId, status: { $in: CANCELLABLE } },
    { $set: { status: "cancelled", activeSlot: null, holdExpiresAt: null, cancelledAt: now, updatedAt: now } },
  );
  return result.modifiedCount === 1;
}

/**
 * A fully refunded order (the verified refund event, wherever the refund was made) cancels its call
 * too. Called only from the payment path, which found the order through the provider's payment id.
 */
export async function cancelBookingOfRefundedOrder(orderId: string, now: Date = new Date()): Promise<void> {
  const { bookings } = await collections();
  await bookings.updateOne(
    { orderId, status: { $in: CANCELLABLE } },
    { $set: { status: "cancelled", activeSlot: null, holdExpiresAt: null, cancelledAt: now, updatedAt: now } },
  );
}

/** Emails the buyer that the coach cancelled their call. Once per order (outbox row); never throws. */
export async function sendCallCancelledEmail(orderId: string, refunded: boolean): Promise<"sent" | "skipped" | "failed"> {
  try {
    const { orders, products, stores, emailOutbox } = await collections();
    const order = await orders.findOne({ _id: orderId });
    if (!order?.booking) return "skipped";
    const key = `${orderId}:call-cancelled`;
    try {
      await emailOutbox.insertOne({ _id: key, orderId, kind: "call-cancelled", status: "sending", attempts: 1, createdAt: new Date(), sentAt: null });
    } catch (error) {
      if (isDuplicateKeyError(error)) return "skipped";
      throw error;
    }
    try {
      const [product, store] = await Promise.all([
        products.findOne({ _id: order.productId, storeId: order.storeId }, { projection: { "coaching.timeZone": 1 } }),
        stores.findOne({ _id: order.storeId }, { projection: { name: 1 } }),
      ]);
      const email = renderCallCancelled({
        storeName: store?.name ?? "Pickstall store",
        customerName: order.buyerName,
        productTitle: order.item.title,
        when: formatCallTime(order.booking.start, order.booking.end, order.booking.buyerTimeZone ?? product?.coaching?.timeZone ?? null),
        refunded,
      });
      await sendEmail({ to: order.buyerEmail, ...email });
      await emailOutbox.updateOne({ _id: key }, { $set: { status: "sent", sentAt: new Date() } });
      return "sent";
    } catch (error) {
      await emailOutbox.updateOne({ _id: key }, { $set: { status: "failed" } }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    logger.error("coaching.cancel_email_failed", { name: error instanceof Error ? error.name : undefined });
    return "failed";
  }
}

/** Sends the cancellation email after the response, so the action answers fast. */
export function scheduleCallCancelledEmail(orderId: string, refunded: boolean): void {
  try {
    after(() => sendCallCancelledEmail(orderId, refunded));
  } catch {
    void sendCallCancelledEmail(orderId, refunded);
  }
}
