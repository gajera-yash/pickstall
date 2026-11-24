import "server-only";

import { REMINDER_COOLDOWN_MS, renderCartReminder, type CartSettings } from "@/lib/abandoned-cart/rules";
import { senderName } from "@/lib/broadcasts/rules";
import { collections } from "@/lib/db/collections";
import { emailDesignOf } from "@/lib/email/looks";
import { publicEnv } from "@/lib/env";
import { sendListEmails } from "@/lib/email/send";
import { logger } from "@/lib/logger";
import { can, storeAccess } from "@/lib/plans/access";
import { emailKeyOf } from "@/lib/subscribers/rules";

// Abandoned cart reminders (D-096). `sendCartReminder` is the job's step (system code keyed by the
// order id); the settings and stats functions filter by the store id from the verified session.

export type CartReminderResult = "sent" | "skipped" | "failed";

/**
 * Sends the one reminder for an unfinished paid checkout, when all of this holds: the order is
 * still not paid and was never reminded; the store has reminders on and can sell; the product is
 * still published; the buyer has not bought it since, has not unsubscribed from the store, and got
 * no reminder for it in the last 7 days. The order is claimed before sending, so it is sent once.
 */
export async function sendCartReminder(orderId: string, now: Date = new Date()): Promise<CartReminderResult> {
  try {
    const { orders, stores, products, subscribers } = await collections();
    const order = await orders.findOne(
      { _id: orderId, status: { $in: ["pending", "failed"] }, totalCents: { $gt: 0 }, reminderSentAt: { $in: [null] } },
      { projection: { storeId: 1, productId: 1, buyerEmail: 1, buyerName: 1, createdAt: 1, bumpOf: 1 } },
    );
    if (!order || order.bumpOf) return "skipped";

    const store = await stores.findOne({ _id: order.storeId, isPublished: true }, { projection: { name: 1, slug: 1, abandonedCart: 1, planTier: 1, suspendedAt: 1, trialEndsAt: 1, foundingEndsAt: 1, billing: 1, emailLook: 1, "theme.accent": 1 } });
    const access = store ? storeAccess(store, now) : null;
    // Reminders need the store to sell and to have cart recovery on its plan.
    if (!store?.abandonedCart?.enabled || !access || !can(access, "sell") || !can(access, "abandonedCart")) return "skipped";
    const product = await products.findOne({ _id: order.productId, storeId: order.storeId, status: "published", deletedAt: { $in: [null] } }, { projection: { slug: 1, title: 1 } });
    if (!product) return "skipped";

    const sameBuyer = { storeId: order.storeId, productId: order.productId, buyerEmail: order.buyerEmail };
    const [boughtSince, remindedRecently, unsubscribed] = await Promise.all([
      orders.countDocuments({ ...sameBuyer, status: "paid", createdAt: { $gte: order.createdAt } }, { limit: 1 }),
      orders.countDocuments({ ...sameBuyer, reminderSentAt: { $gte: new Date(now.getTime() - REMINDER_COOLDOWN_MS) } }, { limit: 1 }),
      subscribers.countDocuments({ storeId: order.storeId, emailKey: emailKeyOf(order.buyerEmail), status: "unsubscribed" }, { limit: 1 }),
    ]);
    if (boughtSince || remindedRecently || unsubscribed) return "skipped";

    const claimed = await orders.updateOne({ _id: orderId, status: { $in: ["pending", "failed"] }, reminderSentAt: { $in: [null] } }, { $set: { reminderSentAt: now } });
    if (claimed.modifiedCount !== 1) return "skipped";

    const checkoutUrl = `${publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/@${store.slug}/${product.slug}/checkout`;
    const rendered = renderCartReminder({ storeName: store.name, productTitle: product.title, buyerName: order.buyerName, subject: store.abandonedCart.subject, body: store.abandonedCart.body, checkoutUrl, design: emailDesignOf(store) });
    await sendListEmails([{ to: order.buyerEmail, ...rendered, fromName: senderName(store.name), replyTo: null, headers: {}, tags: [{ name: "kind", value: "cart" }, { name: "store_id", value: order.storeId }] }], `cart-${orderId}`);
    return "sent";
  } catch (error) {
    logger.error("abandoned_cart.send_failed", { name: error instanceof Error ? error.name : undefined });
    return "failed";
  }
}

/** The store's reminder settings, or the defaults (off). */
export async function findCartSettings(storeId: string): Promise<CartSettings> {
  const { stores } = await collections();
  const store = await stores.findOne({ _id: storeId }, { projection: { abandonedCart: 1 } });
  return store?.abandonedCart ?? { enabled: false, subject: "", body: "" };
}

export async function saveCartSettings(storeId: string, settings: CartSettings): Promise<void> {
  const { stores } = await collections();
  await stores.updateOne({ _id: storeId }, { $set: { abandonedCart: settings } });
}

const STATS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Reminders the store sent in the last 30 days, and how many of those buyers then paid for the
 * same product (a later paid order with the same email).
 */
export async function cartStats(storeId: string, now: Date = new Date()): Promise<{ sent: number; recovered: number }> {
  const { orders } = await collections();
  const since = new Date(now.getTime() - STATS_WINDOW_MS);
  const [result] = await orders
    .aggregate<{ sent: number; recovered: number }>([
      { $match: { storeId, reminderSentAt: { $gte: since } } },
      { $limit: 2000 },
      {
        $lookup: {
          from: "orders",
          let: { email: "$buyerEmail", product: "$productId", at: "$reminderSentAt" },
          pipeline: [
            { $match: { storeId, status: "paid", $expr: { $and: [{ $eq: ["$buyerEmail", "$$email"] }, { $eq: ["$productId", "$$product"] }, { $gte: ["$createdAt", "$$at"] }] } } },
            { $limit: 1 },
          ],
          as: "paid",
        },
      },
      { $group: { _id: null, sent: { $sum: 1 }, recovered: { $sum: { $cond: [{ $gt: [{ $size: "$paid" }, 0] }, 1, 0] } } } },
    ])
    .toArray();
  return { sent: result?.sent ?? 0, recovered: result?.recovered ?? 0 };
}
