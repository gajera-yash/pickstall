import "server-only";

import { randomBytes } from "node:crypto";

import { z } from "zod";

import { collections, type ConnectStateDoc } from "@/lib/db/collections";
import { publicEnv } from "@/lib/env";
import { recordAudit } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { deauthorizeAccount, exchangeConnectCode } from "@/lib/payments/connect";
import { countOtherStoresWithAccount, setStoreStripeConnection } from "@/lib/stores/queries";

// Stripe Connect OAuth, our side (D-053). The `state` is random, bound to the user who started,
// valid for 10 minutes and used once: it is deleted before the code is exchanged, because Stripe
// revokes a connection whose code is used twice. Where the creator lands afterwards is one of two
// fixed pages (no open redirect).

export const CONNECT_STATE_MINUTES = 10;

export type ConnectReturn = ConnectStateDoc["returnTo"];

export const CONNECT_RETURN_PATHS: Record<ConnectReturn, string> = {
  settings: "/dashboard/settings/payments",
  setup: "/dashboard/setup",
};

/** The callback Stripe sends the creator back to. Must be listed in Stripe Dashboard > Connect > OAuth redirects. */
export function connectRedirectUri(): string {
  return `${publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/connect/stripe/callback`;
}

/** Creates a one-time state for this user. */
export async function createConnectState(userId: string, returnTo: ConnectReturn, now = new Date()): Promise<string> {
  const { connectStates } = await collections();
  const state = randomBytes(32).toString("base64url");
  await connectStates.insertOne({ _id: state, userId, returnTo, createdAt: now, expiresAt: new Date(now.getTime() + CONNECT_STATE_MINUTES * 60_000) });
  return state;
}

/** Uses up a state: only the user who created it, only once, only before it expires. Returns where to go back to. */
export async function consumeConnectState(state: string, userId: string, now = new Date()): Promise<ConnectReturn | null> {
  const { connectStates } = await collections();
  const doc = await connectStates.findOneAndDelete({ _id: state, userId, expiresAt: { $gt: now } });
  return doc?.returnTo ?? null;
}

const callbackQuery = z.object({
  state: z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/),
  code: z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/).optional(),
  error: z.string().max(100).optional(),
});

export type ConnectOutcome = "connected" | "cancelled" | "expired" | "wrong_mode" | "in_use" | "error";

/** Where the callback sends the creator, with the outcome for the page to show. */
function landing(returnTo: ConnectReturn | null, outcome: ConnectOutcome): string {
  return `${CONNECT_RETURN_PATHS[returnTo ?? "settings"]}?stripe=${outcome}`;
}

/**
 * Finishes a Connect OAuth return for the signed-in user. Returns the path to redirect to.
 * The account is saved on the user's OWN store (owner filter from the session).
 */
export async function completeStripeConnect(userId: string, query: Record<string, string | undefined>): Promise<string> {
  const parsed = callbackQuery.safeParse(query);
  if (!parsed.success) return landing(null, "expired");

  const returnTo = await consumeConnectState(parsed.data.state, userId);
  if (!returnTo) return landing(null, "expired");
  if (parsed.data.error || !parsed.data.code) return landing(returnTo, "cancelled");

  try {
    const exchanged = await exchangeConnectCode(parsed.data.code);
    if (!exchanged.ok) return landing(returnTo, exchanged.reason === "wrong_mode" ? "wrong_mode" : "error");

    const saved = await setStoreStripeConnection(userId, exchanged.account, { exclusive: true });
    if (saved === "in_use") return landing(returnTo, "in_use");
    if (!saved) return landing(returnTo, "error");
    if (saved.previousAccountId && saved.previousAccountId !== exchanged.account.accountId) {
      await releaseAccount(userId, saved.previousAccountId);
    }
    await recordAudit({ actorId: userId, action: "stripe.connected" });
    return landing(returnTo, "connected");
  } catch (error) {
    logger.error("stripe.connect_failed", { name: error instanceof Error ? error.name : undefined });
    return landing(returnTo, "error");
  }
}

/**
 * Disconnects the account on Stripe's side too, unless another store still sells through it.
 * Best effort: our store is already disconnected, so a failure here is only logged.
 */
export async function releaseAccount(userId: string, accountId: string): Promise<void> {
  try {
    if ((await countOtherStoresWithAccount(userId, accountId)) === 0) await deauthorizeAccount(accountId);
  } catch (error) {
    logger.warn("stripe.deauthorize_failed", { name: error instanceof Error ? error.name : undefined });
  }
}
