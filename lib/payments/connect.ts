import "server-only";

import { serverEnv } from "@/lib/env.server";
import { stripeClient, stripeConfigured } from "@/lib/payments/stripe";
import { isOwnTestAccount, liveKey } from "@/lib/payments/test-account";
import type { AccountStatus } from "@/lib/payments/types";

// Stripe Connect OAuth for Standard accounts (CLAUDE.md 7, D-053), checked against
// docs.stripe.com/connect/oauth-reference on 2026-11-04. Stripe-specific; callers only see plain
// values. The `state` is created and checked by lib/stores/stripe-connect.ts.

/** True when creators can connect their own Stripe account: a key, the Connect client id and the Connect webhook secret. */
export function connectAvailable(): boolean {
  return Boolean(stripeConfigured() && serverEnv.STRIPE_CONNECT_CLIENT_ID);
}

/** The Stripe page the creator is sent to. `read_write` is required to create charges on their account. */
export function connectAuthorizeUrl(input: { state: string; redirectUri: string; email: string | null }): string {
  if (!serverEnv.STRIPE_CONNECT_CLIENT_ID) throw new Error("Stripe Connect is not configured.");
  return stripeClient().oauth.authorizeUrl({
    response_type: "code",
    client_id: serverEnv.STRIPE_CONNECT_CLIENT_ID,
    scope: "read_write",
    redirect_uri: input.redirectUri,
    state: input.state,
    ...(input.email ? { stripe_user: { email: input.email } } : {}),
  });
}

export type ConnectedAccount = { accountId: string; livemode: boolean; status: AccountStatus };

export type ExchangeResult = { ok: true; account: ConnectedAccount } | { ok: false; reason: "wrong_mode" | "no_account" };

/**
 * Exchanges the one-time code for the creator's account id. Stripe revokes the connection if a code
 * is used twice, so the caller must consume the state BEFORE calling this.
 */
export async function exchangeConnectCode(code: string): Promise<ExchangeResult> {
  const token = await stripeClient().oauth.token({ grant_type: "authorization_code", code });
  const accountId = token.stripe_user_id;
  if (!accountId) return { ok: false, reason: "no_account" };
  if (Boolean(token.livemode) !== liveKey()) return { ok: false, reason: "wrong_mode" };
  return { ok: true, account: { accountId, livemode: Boolean(token.livemode), status: await fetchAccountStatus(accountId) } };
}

/** Whether the account can take payments and receive payouts right now. */
export async function fetchAccountStatus(accountId: string): Promise<AccountStatus> {
  const account = await stripeClient().accounts.retrieve(accountId);
  return { chargesEnabled: Boolean(account.charges_enabled), payoutsEnabled: Boolean(account.payouts_enabled), detailsSubmitted: Boolean(account.details_submitted) };
}

/** Disconnects the account from our platform on Stripe's side. Our own test account was never connected through OAuth. */
export async function deauthorizeAccount(accountId: string): Promise<void> {
  if (isOwnTestAccount(accountId) || !serverEnv.STRIPE_CONNECT_CLIENT_ID) return;
  await stripeClient().oauth.deauthorize({ client_id: serverEnv.STRIPE_CONNECT_CLIENT_ID, stripe_user_id: accountId });
}
