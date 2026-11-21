import "server-only";

import { inngest } from "@/lib/inngest/client";
import { sweepPendingPayPalOrders } from "@/lib/orders/paypal-sweep";

/** Every 15 minutes, settles PayPal checkouts the buyer approved but never returned from, or abandoned (D-118). */
export const paypalPendingSweepFunction = inngest.createFunction(
  { id: "paypal-pending-sweep", triggers: [{ cron: "TZ=UTC */15 * * * *" }] },
  async ({ step }) => step.run("sweep-pending-paypal-orders", () => sweepPendingPayPalOrders(new Date())),
);
