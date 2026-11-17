"use server";

import { revalidatePath } from "next/cache";

import { requireCreator } from "@/lib/auth/guards";
import { ORDER_EMAIL_RATE_LIMIT } from "@/lib/config";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { sendOrderConfirmation } from "@/lib/orders/confirmation";
import { findOrderDetail } from "@/lib/orders/creator-queries";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

const ORDERS_PATH = "/dashboard/orders";

/**
 * "Send again" in the order drawer: retries the buyer's access email when it was not delivered (or
 * never tried). Only a paid order of the creator's OWN store (store id from the session). An email
 * that was already sent is not sent twice; the same outbox row as the webhook keeps it to one.
 */
export async function resendOrderEmail(orderId: string): Promise<Result<{ sent: true }>> {
  const { user, store } = await requireCreator(ORDERS_PATH);
  if (typeof orderId !== "string" || !isUuid(orderId)) return err("This email can't be sent.");

  const { max, windowMinutes } = ORDER_EMAIL_RATE_LIMIT;
  if (!(await takeRateLimit(rateLimitKey("order-email", user.id), max, windowMinutes))) return err("Too many tries. Wait a few minutes, then try again.");

  try {
    const order = await findOrderDetail(store.id, orderId);
    if (!order || order.status !== "paid") return err("This email can't be sent.");
    if (order.accessEmail?.status === "sent") return err("This email was already sent. Ask the buyer to check their spam folder.");

    const result = await sendOrderConfirmation(orderId);
    if (result !== "sent") return err("The email still couldn't be sent. Check your email settings, then try again.");
  } catch (error) {
    logger.error("orders.resend_email_failed", { name: error instanceof Error ? error.name : undefined });
    return err("The email couldn't be sent. Try again in a few minutes.");
  }
  revalidatePath(ORDERS_PATH);
  return ok({ sent: true });
}
