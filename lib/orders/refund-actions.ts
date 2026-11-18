"use server";

import { revalidatePath } from "next/cache";

import { requireCreator } from "@/lib/auth/guards";
import { REFUND_RATE_LIMIT } from "@/lib/config";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { requestFullRefund } from "@/lib/orders/refunds";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

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

    const result = await requestFullRefund(store.id, orderId);
    if (result === "not_refundable") return err("This order can't be refunded.");
    if (result === "no_provider") return err("This order can't be refunded here. Refund it in your Stripe Dashboard.");
  } catch (error) {
    logger.error("orders.refund_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't refund this order. Try again, or refund it in your Stripe Dashboard.");
  }
  revalidatePath(ORDERS_PATH);
  return ok({ requested: true });
}
