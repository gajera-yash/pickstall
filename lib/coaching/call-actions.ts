"use server";

import { revalidatePath } from "next/cache";

import { requireCreator } from "@/lib/auth/guards";
import { cancelBooking, findOrderCall, scheduleCallCancelledEmail } from "@/lib/coaching/calls";
import { REFUND_RATE_LIMIT } from "@/lib/config";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { requestFullRefund } from "@/lib/orders/refunds";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

const ORDERS_PATH = "/dashboard/orders";
const CANT = "This call can't be cancelled.";

/**
 * The creator cancels a coaching call of their OWN store (D-086), from the order drawer. A paid
 * call is refunded in full first (the same path as the Refund button); only when the provider
 * accepted the refund is the call cancelled, its time freed and the buyer emailed. A free call is
 * just cancelled. The order turns "refunded" when the provider's verified refund event arrives.
 */
export async function cancelCall(orderId: string): Promise<Result<{ refunded: boolean }>> {
  const { user, store } = await requireCreator(ORDERS_PATH);
  if (typeof orderId !== "string" || !isUuid(orderId)) return err(CANT);

  try {
    const { max, windowMinutes } = REFUND_RATE_LIMIT;
    if (!(await takeRateLimit(rateLimitKey("refund", user.id), max, windowMinutes))) return err("Too many changes at once. Wait a few minutes, then try again.");

    const call = await findOrderCall(store.id, orderId);
    if (!call || !["held", "confirmed", "conflict"].includes(call.status)) return err(CANT);

    // "not_refundable" is a free call (or one already refunded): nothing to pay back.
    const refund = await requestFullRefund(store.id, orderId);
    if (refund === "no_provider") return err("Refund this order in your Stripe Dashboard first; the call is cancelled when the refund arrives.");

    if (!(await cancelBooking(store.id, orderId))) return err(CANT);
    scheduleCallCancelledEmail(orderId, refund === "requested");
    revalidatePath(ORDERS_PATH);
    return ok({ refunded: refund === "requested" });
  } catch (error) {
    logger.error("coaching.cancel_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't cancel this call. Try again, or refund it in your Stripe Dashboard.");
  }
}
