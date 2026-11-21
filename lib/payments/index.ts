import "server-only";

import { mockAllowed, mockProvider } from "@/lib/payments/mock";
import { paypalProvider } from "@/lib/payments/paypal";
import { activeProvider } from "@/lib/payments/paypal-config";
import { storeCanTakePayments, type SellerStore } from "@/lib/payments/seller-status";
import { stripeProvider } from "@/lib/payments/stripe";
import type { PaymentProvider } from "@/lib/payments/types";

export type { PaymentProvider } from "@/lib/payments/types";
export { storeCanTakePayments, type SellerStore } from "@/lib/payments/seller-status";

/**
 * The provider that takes this store's payments, or null when the store cannot sell paid products:
 * the active provider when the creator connected it, else the mock in development only.
 */
export function providerForStore(store: SellerStore): PaymentProvider | null {
  if (storeCanTakePayments(store)) return activeProvider() === "paypal" ? paypalProvider : stripeProvider;
  if (mockAllowed()) return mockProvider;
  return null;
}

/** The seller account id a provider acts on: the store id for PayPal (its own app), the Stripe account for Stripe. */
export function sellerAccountFor(provider: PaymentProvider, store: SellerStore): string | null {
  if (provider.name === "paypal") return store._id;
  if (provider.name === "stripe") return store.stripeAccountId;
  return null;
}

/** Provider by name, for webhook routes and refunds. The mock is only available in development. */
export function providerByName(name: string): PaymentProvider | null {
  if (name === "paypal") return paypalProvider;
  if (name === "stripe") return stripeProvider;
  if (name === "mock" && mockAllowed()) return mockProvider;
  return null;
}
