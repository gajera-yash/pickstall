import "server-only";

import { findRefundableOrder, markRefundRequested } from "@/lib/orders/creator-queries";
import { providerByName } from "@/lib/payments";
import { stripeAccountOfStore } from "@/lib/stores/queries";

/**
 * Asks the payment provider for a full refund of a paid order of THIS store (D-053), and notes the
 * request. The order becomes "refunded" only when the provider's verified refund event arrives.
 * Shared by the order drawer's Refund button and "Cancel call" (D-086). Throws when the provider
 * fails, so the caller can report it.
 */
export async function requestFullRefund(storeId: string, orderId: string): Promise<"requested" | "not_refundable" | "no_provider"> {
  const order = await findRefundableOrder(storeId, orderId);
  if (!order) return "not_refundable";
  const provider = providerByName(order.provider);
  if (!provider) return "no_provider";
  await provider.refund({
    orderId: order.id,
    providerPaymentId: order.providerPaymentId,
    amountCents: order.totalCents,
    // PayPal refunds on the store's own app (D-118); Stripe on the connected account.
    connectedAccountId: order.provider === "paypal" ? storeId : order.provider === "stripe" ? await stripeAccountOfStore(storeId) : null,
  });
  await markRefundRequested(storeId, order.id);
  return "requested";
}
