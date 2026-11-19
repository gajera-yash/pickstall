import "server-only";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth/auth";
import { USERNAME_PATH } from "@/lib/auth/post-login";
import { loginPath } from "@/lib/auth/redirect";
import { logger } from "@/lib/logger";
import { findStoreByOwner, type CreatorStore } from "@/lib/stores/queries";

export type AuthUser = { id: string; email: string | null };

/**
 * The owner's store, looked up once per request: the layout (top bar) and the page both need it,
 * and every lookup is a round trip to the database.
 */
const findCreatorStore = cache(findStoreByOwner);
export type { CreatorStore };

/**
 * The signed-in user from the server-checked session (Better Auth looks the session token up in
 * the database), or null. Cached per request, so several guards cost one check.
 * With Cache Components, call this only inside a <Suspense> boundary.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  // Heals the database connection after an outage without waiting for it, so a session served from
  // the signed cookie stays fast; Better Auth's own queries then use the reopened connection.
  void import("@/lib/db/mongo").then(({ ensureConnected }) => ensureConnected()).catch(() => undefined);
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return null;
    return { id: session.user.id, email: session.user.email ?? null };
  } catch (error) {
    unstable_rethrow(error); // Next.js control flow (prerender bailout) must pass through
    logger.warn("auth.get_session_failed", { name: error instanceof Error ? error.name : undefined });
    return null;
  }
});

/** Signed-in user, or a redirect to /login (with `next` so they come back here). */
export async function requireUser(next?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(next));
  return user;
}

/**
 * requireCreator for a server action started from a signed-in page. If the session has ended in the
 * meantime, the login page says so ("Your session expired") and sends the creator back to
 * `returnTo` afterwards, so they can do it again (QA 2026-11: publish was lost with no message).
 */
export async function requireCreatorForAction(returnTo: string): Promise<{ user: AuthUser; store: CreatorStore }> {
  if (!(await getCurrentUser())) redirect(loginPath(returnTo, { expired: true }));
  return requireCreator(returnTo);
}

/**
 * Signed-in user who owns a store (docs/DECISIONS.md D-003), or a redirect to /login or
 * the username step. The store is looked up by the session's user id, so it is always their own.
 */
export async function requireCreator(next?: string): Promise<{ user: AuthUser; store: CreatorStore }> {
  const user = await requireUser(next);

  let store: CreatorStore | null;
  try {
    store = await findCreatorStore(user.id);
  } catch (error) {
    unstable_rethrow(error);
    logger.error("auth.require_creator_store_query_failed", { name: error instanceof Error ? error.name : undefined });
    throw new Error("Could not load your store.");
  }
  if (!store) redirect(USERNAME_PATH);
  return { user, store };
}
