import "server-only";

import { safeNextPath } from "@/lib/auth/redirect";
import { hasPurchases } from "@/lib/library/queries";
import { logger } from "@/lib/logger";
import { findStoreByOwner } from "@/lib/stores/queries";

export const DASHBOARD_PATH = "/dashboard";
export const LIBRARY_PATH = "/library";
/** Choose a username (and create the draft store): new Google users, taken usernames, users without a store. */
export const USERNAME_PATH = "/signup/username";

// Never send a signed-in user back to the login pages or the auth callback.
const AUTH_PATH = /^\/(login|auth)(?:[/?#]|$)/;

/**
 * Where to send a user right after signing in:
 *  1. a safe, same-origin `next` path, if there is one (for example /library from a receipt link);
 *  2. otherwise /dashboard for creators (they own a store), the username step for everyone else.
 * Destinations enforce access themselves (requireCreator, requireUser); this only picks a landing page.
 */
export async function resolvePostLoginPath(userId: string, next: unknown, email?: string | null): Promise<string> {
  const requested = safeNextPath(next, "");
  if (requested && requested !== "/" && !AUTH_PATH.test(requested)) return requested;

  try {
    if (await findStoreByOwner(userId)) return DASHBOARD_PATH;
    // A buyer (no store, but purchases) lands in their library, not in the creator setup step.
    if (email && (await hasPurchases(email))) return LIBRARY_PATH;
    return USERNAME_PATH;
  } catch (error) {
    logger.error("auth.post_login_store_query_failed", { name: error instanceof Error ? error.name : undefined });
    return "/";
  }
}
