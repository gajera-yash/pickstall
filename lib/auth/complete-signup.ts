import "server-only";

import { cookies } from "next/headers";

import { deviceId } from "@/lib/auth/device";
import { INTENT_COOKIE } from "@/lib/auth/intent-token";
import { DASHBOARD_PATH, USERNAME_PATH, resolvePostLoginPath } from "@/lib/auth/post-login";
import { saveProfile } from "@/lib/auth/profiles";
import { takeSignupIntent } from "@/lib/auth/signup-intents";
import { LEGAL } from "@/lib/legal";
import { logger } from "@/lib/logger";
import { getClientIpHash } from "@/lib/request-ip";
import { createDraftStore } from "@/lib/stores/create-draft-store";
import { checkNewStore, recordNewStore } from "@/lib/stores/new-store-guard";
import { findStoreByOwner } from "@/lib/stores/queries";

/**
 * Runs right after a successful sign-in (email code or Google). If this browser started a signup
 * for this email, the details are applied for the verified user: profile name and phone, then the
 * draft store (D-019). Otherwise the usual post-login rules apply. Returns where to go.
 */
export async function completeSignup(user: { id: string; email?: string | null }, next: unknown): Promise<string> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(INTENT_COOKIE)?.value;
  if (!cookieValue || !user.email) return resolvePostLoginPath(user.id, next, user.email);

  const intent = await takeSignupIntent(user.email, cookieValue);
  cookieStore.delete(INTENT_COOKIE);
  if (!intent) return resolvePostLoginPath(user.id, next, user.email);

  // An existing creator who went through signup again: keep their store and profile as they are.
  if (await findStoreByOwner(user.id)) return DASHBOARD_PATH;

  try {
    // The signup form required the Terms box, so the intent only exists after it was ticked (D-074).
    await saveProfile(user.id, user.email, {
      fullName: intent.fullName,
      ...(intent.phone ? { phone: intent.phone } : {}),
      termsVersion: LEGAL.termsVersion,
      termsAcceptedAt: new Date(),
    });
  } catch (error) {
    logger.warn("signup.profile_update_failed", { name: error instanceof Error ? error.name : undefined });
  }

  // The same gate as the username step (D-071): a blocked store creation lands on the username
  // page, which explains why (a fixed message per reason, nothing from the request is echoed).
  const device = await deviceId();
  const ipHash = await getClientIpHash();
  const allowed = await checkNewStore({ ownerId: user.id, email: user.email, device, ipHash });
  if (!allowed.ok) return `${USERNAME_PATH}?blocked=${allowed.reason}`;

  const result = await createDraftStore(user.id, intent.username, user.email);
  if (result === "created") await recordNewStore({ device, ipHash });
  if (result === "created" || result === "has_store") return DASHBOARD_PATH;
  if (result === "email_used") return `${USERNAME_PATH}?blocked=email_used`;
  if (result === "taken") return `${USERNAME_PATH}?taken=1`;
  return USERNAME_PATH;
}
