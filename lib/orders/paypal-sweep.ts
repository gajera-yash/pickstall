import "server-only";

import { collections } from "@/lib/db/collections";
import { logger } from "@/lib/logger";
import { providerByName } from "@/lib/payments";
import { markOrderFailed } from "@/lib/orders/queries";

// PayPal sends no event for a checkout the buyer never approves (D-118), so pending PayPal orders
// would hold their coupon use and coaching time forever. This sweep asks PayPal where each one
// stands: approved ones are captured (paid only through the verified capture webhook, as always),
// and abandoned or expired ones are marked failed, which gives the coupon and the time back.

/** Leave a checkout alone this long: the buyer may still be paying. */
const GRACE_MS = 30 * 60_000;
/** A checkout not approved after this long is treated as abandoned. */
const ABANDONED_MS = 3 * 60 * 60_000;
const BATCH = 100;

export type SweepResult = { captured: number; failed: number; checked: number };

export async function sweepPendingPayPalOrders(now = new Date()): Promise<SweepResult> {
  const provider = providerByName("paypal");
  const result: SweepResult = { captured: 0, failed: 0, checked: 0 };
  if (!provider?.checkoutStatus || !provider.completeCheckout) return result;

  const { orders } = await collections();
  const pending = await orders
    .find({ provider: "paypal", status: "pending", createdAt: { $lt: new Date(now.getTime() - GRACE_MS) } }, { projection: { storeId: 1, providerSessionId: 1, createdAt: 1 } })
    .sort({ createdAt: 1 })
    .limit(BATCH)
    .toArray();

  for (const order of pending) {
    result.checked++;
    const abandoned = order.createdAt.getTime() < now.getTime() - ABANDONED_MS;
    try {
      if (!order.providerSessionId) {
        // The PayPal order was never created (the checkout failed half way).
        await markOrderFailed(order._id);
        result.failed++;
        continue;
      }
      const status = await provider.checkoutStatus({ providerSessionId: order.providerSessionId, connectedAccountId: order.storeId });
      if (status === "approved") {
        await provider.completeCheckout({ orderId: order._id, providerSessionId: order.providerSessionId, connectedAccountId: order.storeId });
        result.captured++;
      } else if (status === "gone" || (status === "open" && abandoned)) {
        await markOrderFailed(order._id);
        result.failed++;
      }
    } catch (error) {
      // A store that disconnected PayPal can never finish: after the abandoned window, fail it.
      if (abandoned && error instanceof Error && error.message === "PayPal is not connected for this store.") {
        await markOrderFailed(order._id).catch(() => undefined);
        result.failed++;
        continue;
      }
      logger.warn("paypal.sweep_order_failed", { orderId: order._id, name: error instanceof Error ? error.name : undefined });
    }
  }
  return result;
}
