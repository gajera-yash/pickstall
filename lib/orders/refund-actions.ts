"use server";

import { revalidatePath } from "next/cache";

import { requireCreator } from "@/lib/auth/guards";
import { REFUND_RATE_LIMIT } from "@/lib/config";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { findRefundableOrder, markRefundRequested } from "@/lib/orders/creator-queries";
import { providerByName } from "@/lib/payments";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import { stripeAccountOfStore } from "@/lib/stores/queries";

const ORDERS_PATH = "/dashboard/orders";

/**
 * Refunds a paid order in full (D-053), from the order drawer. Only an order of the creator's OWN
 * store (store id from the session). The provider is asked to refund; the order becomes "refunded"
 * only when the provider's verified refund event arrives (lib/payments/process.ts), so there is one
 * path for refunds made here and in the Stripe Dashboard. A retried request is not refunded twice
 * (the Stripe request has an idempotency key per order).
 */
export async function refundOrder(orderId: string): Promise<Result<{ requested: true }>> {
  const { user, store } = await requireCreator(ORDERS_PATH);
  if (typeof orderId !== "string" || !isUuid(orderId)) return err("This order can't be refunded.");

  try {
    const { max, windowMinutes } = REFUND_RATE_LIMIT;
    if (!(await takeRateLimit(rateLimitKey("refund", user.id), max, windowMinutes))) return err("Too many refunds at once. Wait a few minutes, then try again.");

    const order = await findRefundableOrder(store.id, orderId);
    if (!order) return err("This order can't be refunded.");
    const provider = providerByName(order.provider);
    if (!provider) return err("This order can't be refunded here. Refund it in your Stripe Dashboard.");

    await provider.refund({
      orderId: order.id,
      providerPaymentId: order.providerPaymentId,
      amountCents: order.totalCents,
      connectedAccountId: order.provider === "stripe" ? await stripeAccountOfStore(store.id) : null,
    });
    await markRefundRequested(store.id, order.id);
  } catch (error) {
    logger.error("orders.refund_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't refund this order. Try again, or refund it in your Stripe Dashboard.");
  }
  revalidatePath(ORDERS_PATH);
  return ok({ requested: true });
}
