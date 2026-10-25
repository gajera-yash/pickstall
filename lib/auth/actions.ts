"use server";

import { redirect } from "next/navigation";

import { resolvePostLoginPath } from "@/lib/auth/post-login";
import { safeNextPath } from "@/lib/auth/redirect";
import { sendCodeInput, verifyCodeInput } from "@/lib/auth/schemas";
import { publicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { err, ok, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SendCodeState = Result<{ email: string }> | null;
export type VerifyCodeState = Result<never> | null;

const TOO_MANY = "Too many attempts. Wait a minute, then try again.";

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

/**
 * Emails a 6-digit sign-in code. Accounts are created on first sign-in, so the response is
 * the same whether or not the email already has an account (no account enumeration).
 */
export async function sendEmailCode(_prev: SendCodeState, formData: FormData): Promise<SendCodeState> {
  const parsed = sendCodeInput.safeParse({ email: formData.get("email") });
  if (!parsed.success) return err(firstIssue(parsed.error));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    logger.warn("auth.send_code_failed", { status: error.status, code: error.code, message: error.message });
    if (error.status === 429) return err(TOO_MANY);
    return err("Couldn't send the code. Check your connection and try again.");
  }
  return ok({ email: parsed.data.email });
}

/** Checks the code; on success the session cookie is set and the user is redirected. */
export async function verifyEmailCode(_prev: VerifyCodeState, formData: FormData): Promise<VerifyCodeState> {
  const parsed = verifyCodeInput.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return err(firstIssue(parsed.error));

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "email",
  });

  if (error) {
    logger.warn("auth.verify_code_failed", { status: error.status, code: error.code });
    if (error.status === 429) return err(TOO_MANY);
    return err("That code is wrong or has expired. Check the email or request a new code.");
  }

  const userId = data.user?.id;
  redirect(userId ? await resolvePostLoginPath(supabase, userId, parsed.data.next) : "/");
}

/** Starts Google sign-in. Supabase redirects back to /auth/callback with a one-time code. */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next"));
  const callback = new URL("/auth/callback", publicEnv.NEXT_PUBLIC_APP_URL);
  callback.searchParams.set("next", next);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString() },
  });

  if (error || !data.url) {
    logger.warn("auth.google_start_failed", { status: error?.status, code: error?.code });
    redirect("/login?error=google");
  }
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
