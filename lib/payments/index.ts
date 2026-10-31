import "server-only";

import { mockAllowed, mockProvider } from "@/lib/payments/mock";
import { stripeConfigured, stripeProvider } from "@/lib/payments/stripe";
import type { PaymentProvider } from "@/lib/payments/types";

export type { PaymentProvider } from "@/lib/payments/types";

/**
 * The provider that takes this store's payments, or null when the store cannot sell paid products:
 * Stripe when the creator connected their account (and our keys exist), the mock only in development.
 */
export function providerForStore(store: { stripeAccountId: string | null; stripeChargesEnabled: boolean }): PaymentProvider | null {
  if (store.stripeAccountId && store.stripeChargesEnabled && stripeConfigured()) return stripeProvider;
  if (mockAllowed()) return mockProvider;
  return null;
}

/** Provider by name, for webhook routes. The mock is only available in development. */
export function providerByName(name: string): PaymentProvider | null {
  if (name === "stripe") return stripeProvider;
  if (name === "mock" && mockAllowed()) return mockProvider;
  return null;
}
