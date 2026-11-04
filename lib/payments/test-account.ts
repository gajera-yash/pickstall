import "server-only";

import { serverEnv } from "@/lib/env.server";

/** True with a live key (`sk_live_` or a restricted `rk_live_`). Events and accounts of the other mode are refused (D-053). */
export function liveKey(key: string | undefined = serverEnv.STRIPE_SECRET_KEY): boolean {
  return Boolean(key && (key.startsWith("sk_live_") || key.startsWith("rk_live_")));
}

/** True with a test-mode key (`sk_test_`). Live keys never get the shortcuts that use this. */
export function testMode(): boolean {
  return Boolean(serverEnv.STRIPE_SECRET_KEY?.startsWith("sk_test_"));
}

/**
 * Test-only shortcut (D-034): the founder's own Stripe account can be connected as a store's seller
 * account without Connect OAuth. Needs a test key and STRIPE_PLATFORM_ACCOUNT_ID. Returns the id or null.
 */
export function testSellerAccountId(): string | null {
  return testMode() ? (serverEnv.STRIPE_PLATFORM_ACCOUNT_ID ?? null) : null;
}

/** True when this account id is our own test account (a plain charge, not "on behalf of"). */
export function isOwnTestAccount(accountId: string | null): boolean {
  return testMode() && accountId !== null && accountId === serverEnv.STRIPE_PLATFORM_ACCOUNT_ID;
}
