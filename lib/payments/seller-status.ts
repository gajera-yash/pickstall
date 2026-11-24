import "server-only";

import { paypalConnectAvailable, paypalMode } from "@/lib/payments/paypal-config";
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

/** True when the store has a working Stripe seller account. */
export function storeCanTakeStripe(store: SellerStore): boolean {
  return Boolean(store.stripeAccountId && store.stripeChargesEnabled && stripeConfigured());
}

/** True when the store has a working PayPal app. */
export function storeCanTakePayPal(store: SellerStore): boolean {
  return Boolean(store.paypal && store.paypal.mode === paypalMode() && paypalConnectAvailable() && paypalSupportsCurrency(store.currency));
}

/** True when the store has a working seller account for either PayPal or Stripe. */
export function storeCanTakePayments(store: SellerStore): boolean {
  return storeCanTakePayPal(store) || storeCanTakeStripe(store);
}
