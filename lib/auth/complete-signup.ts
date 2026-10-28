import "server-only";

import { cookies } from "next/headers";

import { INTENT_COOKIE } from "@/lib/auth/intent-token";
import { DASHBOARD_PATH, USERNAME_PATH, resolvePostLoginPath } from "@/lib/auth/post-login";
import { saveProfile } from "@/lib/auth/profiles";
import { takeSignupIntent } from "@/lib/auth/signup-intents";
import { logger } from "@/lib/logger";
import { createDraftStore } from "@/lib/stores/create-draft-store";
import { findStoreByOwner } from "@/lib/stores/queries";

/**
 * Runs right after a successful sign-in (email code or Google). If this browser started a signup
 * for this email, the details are applied for the verified user: profile name and phone, then the
 * draft store (D-019). Otherwise the usual post-login rules apply. Returns where to go.
 */
export async function completeSignup(user: { id: string; email?: string | null }, next: unknown): Promise<string> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(INTENT_COOKIE)?.value;
  if (!cookieValue || !user.email) return resolvePostLoginPath(user.id, next);

  const intent = await takeSignupIntent(user.email, cookieValue);
  cookieStore.delete(INTENT_COOKIE);
  if (!intent) return resolvePostLoginPath(user.id, next);

  // An existing creator who went through signup again: keep their store and profile as they are.
  if (await findStoreByOwner(user.id)) return DASHBOARD_PATH;

  try {
    await saveProfile(user.id, user.email, { fullName: intent.fullName, ...(intent.phone ? { phone: intent.phone } : {}) });
  } catch (error) {
    logger.warn("signup.profile_update_failed", { name: error instanceof Error ? error.name : undefined });
  }

  const result = await createDraftStore(user.id, intent.username, intent.fullName);
  if (result === "created" || result === "has_store") return DASHBOARD_PATH;
  if (result === "taken") return `${USERNAME_PATH}?taken=1`;
  return USERNAME_PATH;
}
