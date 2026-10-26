import "server-only";

import { encodeIntentCookie, hashToken, newIntentToken, nextEmailAttempt, parseIntentCookie, tokenMatches } from "@/lib/auth/intent-token";
import { SIGNUP_INTENT_TTL_MINUTES, SIGNUP_RATE_LIMITS } from "@/lib/config";
import { logger } from "@/lib/logger";
import { err, ok, type Result } from "@/lib/result";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Signup details wait here (service role only) until the email code is verified (D-019).

export type SignupIntent = { email: string; username: string; fullName: string; phone: string | null };

type IntentRow = {
  id: string;
  email: string;
  username: string;
  full_name: string;
  phone: string | null;
  token_hash: string;
  expires_at: string;
};

export const TOO_MANY_SIGNUPS = "Too many sign-up attempts. Wait 15 minutes, then try again.";
const GENERIC = "Couldn't start your sign-up. Check your connection and try again.";

/**
 * Saves (or replaces) the intent for this email after the rate limits, and returns the cookie
 * value that binds it to this browser. Expired intents are cleaned up on every call.
 */
export async function saveSignupIntent(intent: SignupIntent, ipHash: string | null): Promise<Result<{ cookie: string }>> {
  const admin = createSupabaseAdminClient();
  const now = new Date();

  const cleanup = await admin.from("signup_intents").delete().lt("expires_at", now.toISOString());
  if (cleanup.error) logger.warn("signup_intents.cleanup_failed", { code: cleanup.error.code });

  if (ipHash) {
    const since = new Date(now.getTime() - SIGNUP_RATE_LIMITS.perIp.windowMinutes * 60_000);
    const { count, error } = await admin
      .from("signup_intents")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since.toISOString())
      .neq("email", intent.email);
    if (error) {
      logger.error("signup_intents.ip_count_failed", { code: error.code });
      return err(GENERIC);
    }
    if ((count ?? 0) >= SIGNUP_RATE_LIMITS.perIp.max) return err(TOO_MANY_SIGNUPS);
  }

  const existing = await admin
    .from("signup_intents")
    .select("attempts, window_started_at")
    .eq("email", intent.email)
    .maybeSingle<{ attempts: number; window_started_at: string }>();
  if (existing.error) {
    logger.error("signup_intents.read_failed", { code: existing.error.code });
    return err(GENERIC);
  }
  const attempt = nextEmailAttempt(existing.data, now);
  if (!attempt.allowed) return err(TOO_MANY_SIGNUPS);

  const token = newIntentToken();
  const saved = await admin
    .from("signup_intents")
    .upsert(
      {
        email: intent.email,
        username: intent.username,
        full_name: intent.fullName,
        phone: intent.phone,
        token_hash: hashToken(token),
        attempts: attempt.attempts,
        window_started_at: attempt.windowStartedAt.toISOString(),
        ip_hash: ipHash,
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + SIGNUP_INTENT_TTL_MINUTES * 60_000).toISOString(),
      },
      { onConflict: "email" },
    )
    .select("id")
    .single<{ id: string }>();
  if (saved.error || !saved.data) {
    logger.error("signup_intents.save_failed", { code: saved.error?.code });
    return err(GENERIC);
  }
  return ok({ cookie: encodeIntentCookie(saved.data.id, token) });
}

/**
 * Returns the intent and deletes it, but only if the cookie token matches, the email is the one
 * that was just verified, and it has not expired. Anything else returns null (and the intent of
 * another browser is never applied).
 */
export async function takeSignupIntent(email: string, cookieValue: string | undefined): Promise<SignupIntent | null> {
  const parsed = parseIntentCookie(cookieValue);
  if (!parsed) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("signup_intents")
    .select("id, email, username, full_name, phone, token_hash, expires_at")
    .eq("id", parsed.id)
    .maybeSingle<IntentRow>();
  if (error || !data) return null;
  if (data.email !== email.toLowerCase() || !tokenMatches(parsed.token, data.token_hash)) return null;

  await admin.from("signup_intents").delete().eq("id", data.id);
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;

  return { email: data.email, username: data.username, fullName: data.full_name, phone: data.phone };
}
