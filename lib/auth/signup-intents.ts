import "server-only";

import { randomUUID } from "node:crypto";

import { encodeIntentCookie, hashToken, newIntentToken, nextEmailAttempt, parseIntentCookie, tokenMatches } from "@/lib/auth/intent-token";
import { SIGNUP_INTENT_TTL_MINUTES, SIGNUP_RATE_LIMITS } from "@/lib/config";
import { collections } from "@/lib/db/collections";
import { logger } from "@/lib/logger";
import type { StoreAcquisition } from "@/lib/marketing/acquisition";
import { err, ok, type Result } from "@/lib/result";

// Signup details wait here (server only) until the email code is verified (D-019).
// Expired intents are removed by the TTL index on `expiresAt` (lib/db/mongo.ts).

/** `acquisition` (D-119): where the signup came from, cleaned by `acquisitionFrom`; left out when direct. */
export type SignupIntent = { email: string; username: string; fullName: string; phone: string | null; acquisition?: StoreAcquisition };

export const TOO_MANY_SIGNUPS = "Too many sign-up attempts. Wait 15 minutes, then try again.";
const GENERIC = "Couldn't start your sign-up. Check your connection and try again.";

/**
 * Saves (or replaces) the intent for this email after the rate limits, and returns the cookie
 * value that binds it to this browser.
 */
export async function saveSignupIntent(intent: SignupIntent, ipHash: string | null): Promise<Result<{ cookie: string }>> {
  const now = new Date();
  try {
    const { signupIntents } = await collections();

    if (ipHash) {
      const since = new Date(now.getTime() - SIGNUP_RATE_LIMITS.perIp.windowMinutes * 60_000);
      const count = await signupIntents.countDocuments({ ipHash, createdAt: { $gte: since }, email: { $ne: intent.email } });
      if (count >= SIGNUP_RATE_LIMITS.perIp.max) return err(TOO_MANY_SIGNUPS);
    }

    const existing = await signupIntents.findOne({ email: intent.email }, { projection: { attempts: 1, windowStartedAt: 1 } });
    const attempt = nextEmailAttempt(
      existing ? { attempts: existing.attempts, window_started_at: existing.windowStartedAt.toISOString() } : null,
      now,
    );
    if (!attempt.allowed) return err(TOO_MANY_SIGNUPS);

    const token = newIntentToken();
    const saved = await signupIntents.findOneAndUpdate(
      { email: intent.email },
      {
        $set: {
          username: intent.username,
          fullName: intent.fullName,
          phone: intent.phone,
          acquisition: intent.acquisition ?? null,
          tokenHash: hashToken(token),
          attempts: attempt.attempts,
          windowStartedAt: attempt.windowStartedAt,
          ipHash,
          createdAt: now,
          expiresAt: new Date(now.getTime() + SIGNUP_INTENT_TTL_MINUTES * 60_000),
        },
        $setOnInsert: { _id: randomUUID() },
      },
      { upsert: true, returnDocument: "after", projection: { _id: 1 } },
    );
    if (!saved) return err(GENERIC);
    return ok({ cookie: encodeIntentCookie(saved._id, token) });
  } catch (error) {
    logger.error("signup_intents.save_failed", { name: error instanceof Error ? error.name : undefined });
    return err(GENERIC);
  }
}

/**
 * Returns the intent and deletes it, but only if the cookie token matches, the email is the one
 * that was just verified, and it has not expired. Anything else returns null (and the intent of
 * another browser is never applied).
 */
export async function takeSignupIntent(email: string, cookieValue: string | undefined): Promise<SignupIntent | null> {
  const parsed = parseIntentCookie(cookieValue);
  if (!parsed) return null;

  try {
    const { signupIntents } = await collections();
    const doc = await signupIntents.findOne({ _id: parsed.id });
    if (!doc) return null;
    if (doc.email !== email.toLowerCase() || !tokenMatches(parsed.token, doc.tokenHash)) return null;

    await signupIntents.deleteOne({ _id: doc._id });
    if (doc.expiresAt.getTime() <= Date.now()) return null;

    return { email: doc.email, username: doc.username, fullName: doc.fullName, phone: doc.phone, ...(doc.acquisition ? { acquisition: doc.acquisition } : {}) };
  } catch (error) {
    logger.error("signup_intents.take_failed", { name: error instanceof Error ? error.name : undefined });
    return null;
  }
}
