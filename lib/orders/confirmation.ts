import "server-only";

import { after } from "next/server";

import { createAccessToken } from "@/lib/auth/access-tokens";
import { buildIcs, formatCallTime } from "@/lib/coaching/ics";
import { publicEnv } from "@/lib/env";
import { collections } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { EmailSendError, sendEmail } from "@/lib/email/send";
import { renderOrderEmail, type CallDetails } from "@/lib/email/templates";
import { logger } from "@/lib/logger";

/** A "sending" row older than this is treated as failed (the send was cut off). */
const STUCK_SENDING_MS = 10 * 60 * 1000;

/**
 * Sends the order confirmation: a unique link where the buyer creates a password and opens their
 * purchase (D-037). One outbox row per order makes this safe to call twice (a replayed webhook cannot
 * email the buyer twice); a failed send is kept as `failed` and tried again the next time it is called.
 */
export async function sendOrderConfirmation(orderId: string): Promise<"sent" | "skipped" | "failed"> {
  try {
    const { orders, products, stores, emailOutbox, bookings } = await collections();
    const order = await orders.findOne({ _id: orderId, status: "paid" });
    if (!order) return "skipped";

    const key = `${orderId}:order-confirmation`;
    try {
      await emailOutbox.insertOne({ _id: key, orderId, kind: "order-confirmation", status: "sending", attempts: 1, createdAt: new Date(), sentAt: null });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      // Already handled: take it again only if the last attempt failed, or stopped half way (the
      // function was stopped while sending) long enough ago that it is not still running.
      const stuckBefore = new Date(Date.now() - STUCK_SENDING_MS);
      const retry = await emailOutbox.updateOne(
        { _id: key, $or: [{ status: "failed" }, { status: "sending", createdAt: { $lt: stuckBefore } }] },
        { $set: { status: "sending", createdAt: new Date() }, $inc: { attempts: 1 } },
      );
      if (retry.matchedCount === 0) return "skipped";
    }

    // Which part failed, for the log (the access link, the email itself, ...).
    let stage = "load";
    try {
      const [product, store, booking] = await Promise.all([
        products.findOne({ _id: order.productId, storeId: order.storeId }, { projection: { afterPurchase: 1, "coaching.meetingUrl": 1, "coaching.timeZone": 1 } }),
        stores.findOne({ _id: order.storeId }, { projection: { name: 1 } }),
        order.booking ? bookings.findOne({ orderId, storeId: order.storeId }, { projection: { status: 1 } }) : null,
      ]);
      // A coaching call (D-084): its time in the buyer's own zone, the meeting link, and a calendar file.
      const confirmedCall = order.booking && booking?.status === "confirmed";
      const call: CallDetails | null =
        order.booking && booking && (booking.status === "confirmed" || booking.status === "conflict")
          ? {
              status: booking.status,
              when: formatCallTime(order.booking.start, order.booking.end, order.booking.buyerTimeZone ?? product?.coaching?.timeZone ?? null),
              meetingUrl: product?.coaching?.meetingUrl ?? null,
            }
          : null;
      stage = "access_link";
      const token = await createAccessToken({ orderId, email: order.buyerEmail, name: order.buyerName });
      stage = "render";
      const email = renderOrderEmail({
        storeName: store?.name ?? "Pickstall store",
        vars: { customerName: order.buyerName, productTitle: order.item.title, accessLink: new URL(`/welcome/${token}`, publicEnv.NEXT_PUBLIC_APP_URL).href },
        subject: product?.afterPurchase?.emailSubject ?? null,
        body: product?.afterPurchase?.emailBody ?? null,
        call,
      });
      const storeName = store?.name ?? "Pickstall store";
      const attachments =
        confirmedCall && order.booking
          ? [
              {
                filename: "call.ics",
                contentType: "text/calendar; charset=utf-8; method=PUBLISH",
                content: buildIcs({
                  uid: orderId,
                  start: order.booking.start,
                  end: order.booking.end,
                  title: `${order.item.title} with ${storeName}`,
                  description: product?.coaching?.meetingUrl ? `Join: ${product.coaching.meetingUrl}` : `${storeName} will email you the meeting link before the call.`,
                  url: product?.coaching?.meetingUrl ?? null,
                  now: new Date(),
                }),
              },
            ]
          : undefined;
      // Development only: the link is also logged, because test emails may not be deliverable.
      if (process.env.NODE_ENV !== "production") logger.debug("order_email.dev_link", { link: email.text.match(/https?:\/\/\S+\/welcome\/\S+/)?.[0] });
      stage = "send";
      await sendEmail({ to: order.buyerEmail, ...email, ...(attachments ? { attachments } : {}) });
      await emailOutbox.updateOne({ _id: key }, { $set: { status: "sent", sentAt: new Date() } });
      return "sent";
    } catch (error) {
      await emailOutbox.updateOne({ _id: key }, { $set: { status: "failed" } }).catch(() => undefined);
      logger.error("order_email.failed", { orderId, stage, name: error instanceof Error ? error.name : undefined, reason: error instanceof EmailSendError ? error.reason : undefined });
      return "failed";
    }
  } catch (error) {
    logger.error("order_email.error", { name: error instanceof Error ? error.name : undefined });
    return "failed";
  }
}

/** Runs the confirmation after the response is sent (a webhook must answer fast). Falls back to running it directly. */
export function scheduleOrderConfirmation(orderId: string): void {
  try {
    after(() => sendOrderConfirmation(orderId));
  } catch {
    void sendOrderConfirmation(orderId);
  }
}
