import "server-only";

import { PAYPAL_CURRENCIES, type Currency } from "@/lib/config";
import { serverEnv } from "@/lib/env.server";
import type { PayPalCredentials, PayPalMode } from "@/lib/payments/paypal-api";

// Which provider takes payments and how PayPal is set up (D-118).

/** PayPal unless PAYMENT_PROVIDER=stripe turns the dormant Stripe code back on. */
export function activeProvider(): "paypal" | "stripe" {
  return serverEnv.PAYMENT_PROVIDER === "stripe" ? "stripe" : "paypal";
}

/** Sandbox until the founder sets PAYPAL_MODE=live. Creators' apps must be in this mode too. */
export function paypalMode(): PayPalMode {
  return serverEnv.PAYPAL_MODE === "live" ? "live" : "sandbox";
}

/** The currencies a store may pick: PayPal's list (D-118), or all of them (undefined) with Stripe. */
export function providerCurrencies(): readonly Currency[] | undefined {
  return activeProvider() === "paypal" ? PAYPAL_CURRENCIES : undefined;
}

/** True when creators can connect their PayPal app: PayPal is the provider and secrets can be encrypted. */
export function paypalConnectAvailable(): boolean {
  return activeProvider() === "paypal" && Boolean(serverEnv.PAYMENT_CREDENTIALS_KEY);
}

/** The key that encrypts creators' app secrets. Throws when it is missing. */
export function credentialsKey(): string {
  if (!serverEnv.PAYMENT_CREDENTIALS_KEY) throw new Error("PAYMENT_CREDENTIALS_KEY is not set.");
  return serverEnv.PAYMENT_CREDENTIALS_KEY;
}

/** Our own PayPal app (platform billing), or null when it is not configured. */
export function platformPayPal(): (PayPalCredentials & { webhookId: string | null }) | null {
  if (!serverEnv.PAYPAL_CLIENT_ID || !serverEnv.PAYPAL_CLIENT_SECRET) return null;
  return { mode: paypalMode(), clientId: serverEnv.PAYPAL_CLIENT_ID, secret: serverEnv.PAYPAL_CLIENT_SECRET, webhookId: serverEnv.PAYPAL_WEBHOOK_ID ?? null };
}
