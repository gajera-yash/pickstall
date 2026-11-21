import "server-only";

import { activeProvider, paypalConnectAvailable, paypalMode } from "@/lib/payments/paypal-config";
import { paypalSupportsCurrency } from "@/lib/payments/paypal-money";
import { stripeConfigured } from "@/lib/payments/stripe";

/** What choosing a store's provider needs to know about the store. */
export type SellerStore = {
  _id: string;
  currency: string;
  paypal?: { mode: "sandbox" | "live" } | null;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
};

/** True when the store has a working seller account for the active provider (PayPal by default, D-118). */
export function storeCanTakePayments(store: SellerStore): boolean {
  if (activeProvider() === "paypal") return Boolean(store.paypal && store.paypal.mode === paypalMode() && paypalConnectAvailable() && paypalSupportsCurrency(store.currency));
  return Boolean(store.stripeAccountId && store.stripeChargesEnabled && stripeConfigured());
}
