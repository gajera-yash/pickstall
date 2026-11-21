import "server-only";

import { collections } from "@/lib/db/collections";
import { logger } from "@/lib/logger";
import { providerByName } from "@/lib/payments";

/**
 * The buyer is back from PayPal (D-118): capture the approved PayPal order of THIS store's pending
 * order. Idempotent (PayPal-Request-Id per order), so a reload, the CHECKOUT.ORDER.APPROVED webhook
 * and the pending sweep can all call it. It never marks the order paid; the verified capture webhook
 * does. Returns quietly on any problem: the thank-you page then keeps showing "Confirming".
 */
export async function captureReturningPayPalOrder(storeId: string, orderId: string): Promise<void> {
  const { orders } = await collections();
  const order = await orders.findOne({ _id: orderId, storeId, provider: "paypal", status: "pending" }, { projection: { providerSessionId: 1 } });
  if (!order?.providerSessionId) return;
  try {
    await providerByName("paypal")?.completeCheckout?.({ orderId, providerSessionId: order.providerSessionId, connectedAccountId: storeId });
  } catch (error) {
    // Not approved yet (buyer cancelled), declined, or already captured: nothing to do here.
    logger.warn("paypal.return_capture_failed", { orderId, name: error instanceof Error ? error.name : undefined });
  }
}
