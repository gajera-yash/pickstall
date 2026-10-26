import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { INTENT_COOKIE } from "@/lib/auth/intent-token";
import { DASHBOARD_PATH, USERNAME_PATH, resolvePostLoginPath } from "@/lib/auth/post-login";
import { takeSignupIntent } from "@/lib/auth/signup-intents";
import { logger } from "@/lib/logger";
import { createDraftStore } from "@/lib/stores/create-draft-store";

/**
 * Runs right after a successful sign-in (email code or Google). If this browser started a signup
 * for this email, the details are applied with the user's own session: profile name and phone,
 * then the draft store (D-019). Otherwise the usual post-login rules apply. Returns where to go.
 */
export async function completeSignup(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
  next: unknown,
): Promise<string> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(INTENT_COOKIE)?.value;
  if (!cookieValue || !user.email) return resolvePostLoginPath(supabase, user.id, next);

  const intent = await takeSignupIntent(user.email, cookieValue);
  cookieStore.delete(INTENT_COOKIE);
  if (!intent) return resolvePostLoginPath(supabase, user.id, next);

  // An existing creator who went through signup again: keep their store and profile as they are.
  const existing = await supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (existing.data) return DASHBOARD_PATH;

  const profile = await supabase
    .from("profiles")
    .update({ full_name: intent.fullName, ...(intent.phone ? { phone: intent.phone } : {}) })
    .eq("id", user.id);
  if (profile.error) logger.warn("signup.profile_update_failed", { code: profile.error.code });

  const result = await createDraftStore(supabase, user.id, intent.username, intent.fullName);
  if (result === "created" || result === "has_store") return DASHBOARD_PATH;
  if (result === "taken") return `${USERNAME_PATH}?taken=1`;
  return USERNAME_PATH;
}
