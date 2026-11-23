import "server-only";

import { senderName } from "@/lib/broadcasts/rules";
import { collections } from "@/lib/db/collections";
import { emailDesignOf } from "@/lib/email/looks";
import { publicEnv } from "@/lib/env";
import { sendListEmails } from "@/lib/email/send";
import { logger } from "@/lib/logger";
import { can, storeAccess } from "@/lib/plans/access";
import { renderReviewRequest, type ReviewRequestSettings } from "@/lib/review-request/rules";
import { emailKeyOf } from "@/lib/subscribers/rules";

// "Please review" emails (D-117). `sendReviewRequest` is the job's step (system code keyed by the
// order id); the settings functions filter by the store id from the verified session.

export type ReviewRequestResult = "sent" | "skipped" | "failed";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Sends the one review request for a paid order, when all of this holds: the order is still paid
 * (not refunded), is not a bump, and was never asked; the store has the email on, is not suspended,
 * can sell and has automations on its plan; the product still exists; the buyer has not reviewed it
 * yet and has not unsubscribed from the store. The order is claimed before sending, so it is sent once.
 */
export async function sendReviewRequest(orderId: string, now: Date = new Date()): Promise<ReviewRequestResult> {
  try {
    const { orders, stores, products, reviews, subscribers } = await collections();
    const order = await orders.findOne(
      { _id: orderId, status: "paid", reviewRequestSentAt: { $in: [null] } },
      { projection: { storeId: 1, productId: 1, buyerEmail: 1, buyerName: 1, bumpOf: 1 } },
    );
    if (!order || order.bumpOf) return "skipped";

    const store = await stores.findOne({ _id: order.storeId }, { projection: { name: 1, reviewRequest: 1, planTier: 1, suspendedAt: 1, trialEndsAt: 1, foundingEndsAt: 1, billing: 1, emailLook: 1, "theme.accent": 1 } });
    const access = store ? storeAccess(store, now) : null;
    if (!store?.reviewRequest?.enabled || store.suspendedAt || !access || !can(access, "sell") || !can(access, "automations")) return "skipped";
    const product = await products.findOne({ _id: order.productId, storeId: order.storeId, deletedAt: { $in: [null] } }, { projection: { title: 1 } });
    if (!product) return "skipped";

    const buyerKey = order.buyerEmail.trim().toLowerCase();
    const [reviewed, unsubscribed] = await Promise.all([
      reviews.countDocuments({ storeId: order.storeId, productId: order.productId, buyerKey }, { limit: 1 }),
      subscribers.countDocuments({ storeId: order.storeId, emailKey: emailKeyOf(order.buyerEmail), status: "unsubscribed" }, { limit: 1 }),
    ]);
    if (reviewed || unsubscribed) return "skipped";

    const claimed = await orders.updateOne({ _id: orderId, status: "paid", reviewRequestSentAt: { $in: [null] } }, { $set: { reviewRequestSentAt: now } });
    if (claimed.modifiedCount !== 1) return "skipped";

    const reviewUrl = `${publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/library/${orderId}`;
    const rendered = renderReviewRequest({ storeName: store.name, productTitle: product.title, buyerName: order.buyerName, subject: store.reviewRequest.subject, body: store.reviewRequest.body, reviewUrl, design: emailDesignOf(store) });
    await sendListEmails(
      [{ to: order.buyerEmail, ...rendered, fromName: senderName(store.name), replyTo: null, headers: {}, tags: [{ name: "kind", value: "review-request" }, { name: "store_id", value: order.storeId }] }],
      `review-${orderId}`,
    );
    return "sent";
  } catch (error) {
    logger.error("review_request.send_failed", { name: error instanceof Error ? error.name : undefined });
    return "failed";
  }
}

/** The store's review request settings, or the defaults (off). */
export async function findReviewRequestSettings(storeId: string): Promise<ReviewRequestSettings> {
  const { stores } = await collections();
  const store = await stores.findOne({ _id: storeId }, { projection: { reviewRequest: 1 } });
  return store?.reviewRequest ?? { enabled: false, subject: "", body: "" };
}

export async function saveReviewRequestSettings(storeId: string, settings: ReviewRequestSettings): Promise<void> {
  const { stores } = await collections();
  await stores.updateOne({ _id: storeId }, { $set: { reviewRequest: settings } });
}

/** Review requests the store sent in the last 30 days. */
export async function reviewRequestsSent(storeId: string, now: Date = new Date()): Promise<number> {
  const { orders } = await collections();
  return orders.countDocuments({ storeId, reviewRequestSentAt: { $gte: new Date(now.getTime() - MONTH_MS) } });
}
