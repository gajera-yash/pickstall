"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { completeSignup } from "@/lib/auth/complete-signup";
import { getCurrentUser } from "@/lib/auth/guards";
import { INTENT_COOKIE } from "@/lib/auth/intent-token";
import { DASHBOARD_PATH, USERNAME_PATH } from "@/lib/auth/post-login";
import { loginPath, safeNextPath } from "@/lib/auth/redirect";
import { claimUsernameInput, sendCodeInput, signupInput, verifyCodeInput } from "@/lib/auth/schemas";
import { saveSignupIntent } from "@/lib/auth/signup-intents";
import { SIGNUP_INTENT_TTL_MINUTES } from "@/lib/config";
import { publicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getClientIpHash } from "@/lib/request-ip";
import { err, ok, type Result } from "@/lib/result";
import { SLUG_TAKEN_MESSAGE } from "@/lib/slug";
import { createDraftStore } from "@/lib/stores/create-draft-store";
import { isSlugTaken } from "@/lib/stores/slug-availability";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SendCodeState = Result<{ email: string }> | null;
export type VerifyCodeState = Result<never> | null;
export type SignupState = Result<{ email: string }> | null;
export type ClaimUsernameState = Result<never> | null;

const TOO_MANY = "Too many attempts. Wait a minute, then try again.";

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

/** First validation problem, with the form field it belongs to. */
function fieldIssue(error: { issues: { message: string; path: PropertyKey[] }[] }) {
  const issue = error.issues[0];
  const field = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;
  return err(issue?.message ?? "Check the form and try again.", field);
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

/**
 * Signup step 1 (D-019): validates, checks the username is free (no reservation), applies the
 * rate limits, saves the details server-side as a signup intent bound to this browser (httpOnly
 * cookie), then emails a 6-digit code. Nothing goes into the client-editable auth metadata.
 * Same response whether or not the email already has an account.
 */
export async function startSignup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupInput.safeParse({
    username: formData.get("username") ?? "",
    fullName: formData.get("fullName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return fieldIssue(parsed.error);
  const { username, fullName, email, phone } = parsed.data;

  const taken = await isSlugTaken(username);
  if (!taken.ok) return taken;
  if (taken.data) return err(SLUG_TAKEN_MESSAGE, "username");

  const saved = await saveSignupIntent({ email, username, fullName, phone: phone ?? null }, await getClientIpHash());
  if (!saved.ok) return saved;

  const cookieStore = await cookies();
  cookieStore.set(INTENT_COOKIE, saved.data.cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SIGNUP_INTENT_TTL_MINUTES * 60,
  });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });

  if (error) {
    logger.warn("auth.signup_send_code_failed", { status: error.status, code: error.code });
    if (error.status === 429) return err(TOO_MANY);
    return err("Couldn't send the code. Check your connection and try again.");
  }
  return ok({ email });
}

/**
 * Checks the code; on success the session cookie is set, a pending signup from this browser is
 * completed (draft store), and the user is redirected.
 */
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

  const user = data.user;
  redirect(user ? await completeSignup(supabase, user, parsed.data.next) : "/");
}

/**
 * Username step (D-020): for Google users, users without a store, or when the signup username was
 * taken. Saves the profile details and creates the draft store with the user's own session.
 */
export async function claimUsername(_prev: ClaimUsernameState, formData: FormData): Promise<ClaimUsernameState> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(USERNAME_PATH));

  const fullNameField = formData.get("fullName");
  const parsed = claimUsernameInput.safeParse({
    username: formData.get("username") ?? "",
    fullName: typeof fullNameField === "string" ? fullNameField : undefined,
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return fieldIssue(parsed.error);
  const { username, fullName, phone } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null }>();
  if (!profile?.full_name && !fullName) return err("Enter your full name.", "fullName");

  const changes = { ...(fullName ? { full_name: fullName } : {}), ...(phone ? { phone } : {}) };
  if (Object.keys(changes).length > 0) {
    const updated = await supabase.from("profiles").update(changes).eq("id", user.id);
    if (updated.error) logger.warn("signup.profile_update_failed", { code: updated.error.code });
  }

  const result = await createDraftStore(supabase, user.id, username, fullName ?? profile?.full_name ?? username);
  if (result === "taken") return err(SLUG_TAKEN_MESSAGE, "username");
  if (result === "error") return err("Couldn't create your store. Check your connection and try again.");
  redirect(DASHBOARD_PATH);
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
