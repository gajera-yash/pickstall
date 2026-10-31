"use server";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";

import { consumeAccessToken, hashToken, lookupAccessToken, releaseAccessToken } from "@/lib/auth/access-tokens";
import { auth } from "@/lib/auth/auth";
import { createBuyerPassword } from "@/lib/auth/buyer-account";
import { passwordInput } from "@/lib/auth/password-schemas";
import { PASSWORD_RATE_LIMIT } from "@/lib/config";
import { logger } from "@/lib/logger";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";
import { err, type Result } from "@/lib/result";

export type PasswordState = Result<never> | null;

const GENERIC = "Couldn't save your password. Check your connection and try again.";

/**
 * The buyer opened the link from their order email and chose a password (D-037). The link is checked
 * and used up first (only one request can win), the password is saved for the email that paid, and the
 * buyer is signed in and sent to the purchase. If saving fails, the link is given back so they can retry.
 */
export async function createPasswordFromLink(token: string, _prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = passwordInput.safeParse({ password: formData.get("password") ?? "", confirm: formData.get("confirm") ?? "" });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return err(issue?.message ?? "Check the form and try again.", typeof issue?.path[0] === "string" ? issue.path[0] : undefined);
  }
  const { password } = parsed.data;

  let orderId: string;
  let email: string;
  let hasPassword = false;
  try {
    const { max, windowMinutes } = PASSWORD_RATE_LIMIT;
    const ipHash = await getClientIpHash();
    const byToken = await takeRateLimit(rateLimitKey("password-link:token", hashToken(token)), max, windowMinutes);
    const byIp = ipHash ? await takeRateLimit(rateLimitKey("password-link:ip", ipHash), max * 3, windowMinutes) : true;
    if (!byToken || !byIp) return err("Too many attempts. Wait a few minutes, then try again.");

    const state = await lookupAccessToken(token);
    if (state.status !== "valid") return err("This link isn't valid anymore. Sign in, or ask for a new link.");
    orderId = state.token.orderId;
    email = state.token.email;

    if (!(await consumeAccessToken(token))) return err("This link was just used. Sign in instead.");
    try {
      const result = await createBuyerPassword({ email, name: state.token.name, password });
      if (!result.ok) {
        // This email already has a password: nothing is changed, the buyer just signs in.
        hasPassword = true;
        await releaseAccessToken(token);
      }
    } catch (error) {
      await releaseAccessToken(token).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    unstable_rethrow(error);
    logger.error("buyer_password.failed", { name: error instanceof Error ? error.name : undefined });
    return err(GENERIC);
  }
  if (hasPassword) redirect(`/login?next=${encodeURIComponent(`/library/${orderId}`)}`);

  try {
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch (error) {
    logger.warn("buyer_password.sign_in_failed", { name: error instanceof Error ? error.name : undefined });
    redirect(`/login?next=${encodeURIComponent(`/library/${orderId}`)}`);
  }
  redirect(`/library/${orderId}`);
}
