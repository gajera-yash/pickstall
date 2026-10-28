"use server";

import { isAPIError } from "better-auth/api";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { completeSignup } from "@/lib/auth/complete-signup";
import { getCurrentUser } from "@/lib/auth/guards";
import { INTENT_COOKIE } from "@/lib/auth/intent-token";
import { DASHBOARD_PATH, USERNAME_PATH } from "@/lib/auth/post-login";
import { getProfile, saveProfile } from "@/lib/auth/profiles";
import { loginPath, safeNextPath } from "@/lib/auth/redirect";
import { claimUsernameInput, sendCodeInput, signupInput, verifyCodeInput } from "@/lib/auth/schemas";
import { saveSignupIntent } from "@/lib/auth/signup-intents";
import { SEND_CODE_RATE_LIMITS, SIGNUP_INTENT_TTL_MINUTES } from "@/lib/config";
import { logger } from "@/lib/logger";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";
import { err, ok, type Result } from "@/lib/result";
import { SLUG_TAKEN_MESSAGE } from "@/lib/slug";
import { createDraftStore } from "@/lib/stores/create-draft-store";
import { isSlugTaken } from "@/lib/stores/slug-availability";

export type SendCodeState = Result<{ email: string }> | null;
export type VerifyCodeState = Result<never> | null;
export type SignupState = Result<{ email: string }> | null;
export type ClaimUsernameState = Result<never> | null;

const TOO_MANY = "Too many attempts. Wait a minute, then try again.";
const SEND_FAILED = "Couldn't send the code. Check your connection and try again.";

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

/** First validation problem, with the form field it belongs to. */
function fieldIssue(error: { issues: { message: string; path: PropertyKey[] }[] }) {
  const issue = error.issues[0];
  const field = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;
  return err(issue?.message ?? "Check the form and try again.", field);
}

function errorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

/** Per-email and per-IP limits on sending codes. True when this send is allowed. */
async function allowCodeSend(email: string): Promise<boolean> {
  const { perEmail, perIp } = SEND_CODE_RATE_LIMITS;
  if (!(await takeRateLimit(rateLimitKey("send-code:email", email), perEmail.max, perEmail.windowMinutes))) return false;
  const ipHash = await getClientIpHash();
  if (ipHash && !(await takeRateLimit(rateLimitKey("send-code:ip", ipHash), perIp.max, perIp.windowMinutes))) return false;
  return true;
}

/** Rate-limits, then emails a 6-digit sign-in code (accounts are created on first sign-in). */
async function sendCode(email: string): Promise<Result<{ email: string }>> {
  try {
    if (!(await allowCodeSend(email))) return err(TOO_MANY);
    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
    return ok({ email });
  } catch (error) {
    logger.warn("auth.send_code_failed", { name: errorName(error), status: isAPIError(error) ? error.statusCode : undefined });
    if (isAPIError(error) && error.statusCode === 429) return err(TOO_MANY);
    return err(SEND_FAILED);
  }
}

/**
 * Emails a 6-digit sign-in code. Accounts are created on first sign-in, so the response is
 * the same whether or not the email already has an account (no account enumeration).
 */
export async function sendEmailCode(_prev: SendCodeState, formData: FormData): Promise<SendCodeState> {
  const parsed = sendCodeInput.safeParse({ email: formData.get("email") });
  if (!parsed.success) return err(firstIssue(parsed.error));
  return sendCode(parsed.data.email);
}

/**
 * Signup step 1 (D-019): validates, checks the username is free (no reservation), applies the
 * rate limits, saves the details server-side as a signup intent bound to this browser (httpOnly
 * cookie), then emails a 6-digit code. Same response whether or not the email already has an account.
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

  return sendCode(email);
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

  let user: { id: string; email: string };
  try {
    const result = await auth.api.signInEmailOTP({
      body: { email: parsed.data.email, otp: parsed.data.code },
      headers: await headers(),
    });
    user = result.user;
  } catch (error) {
    logger.warn("auth.verify_code_failed", { name: errorName(error), status: isAPIError(error) ? error.statusCode : undefined });
    if (isAPIError(error) && error.statusCode === 429) return err(TOO_MANY);
    return err("That code is wrong or has expired. Check the email or request a new code.");
  }

  redirect(await completeSignup(user, parsed.data.next));
}

/**
 * Username step (D-020): for Google users, users without a store, or when the signup username was
 * taken. Saves the profile details and creates the draft store for the signed-in user.
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

  let profile;
  try {
    profile = await getProfile(user.id);
    if (!profile?.fullName && !fullName) return err("Enter your full name.", "fullName");
    const changes = { ...(fullName ? { fullName } : {}), ...(phone ? { phone } : {}) };
    if (Object.keys(changes).length > 0 || !profile) await saveProfile(user.id, user.email ?? "", changes);
  } catch (error) {
    logger.warn("signup.profile_update_failed", { name: errorName(error) });
    return err("Couldn't save your details. Check your connection and try again.");
  }

  const result = await createDraftStore(user.id, username, fullName ?? profile?.fullName ?? username);
  if (result === "taken") return err(SLUG_TAKEN_MESSAGE, "username");
  if (result === "error") return err("Couldn't create your store. Check your connection and try again.");
  redirect(DASHBOARD_PATH);
}

/** Starts Google sign-in. Google returns to Better Auth, which then sends the user to /auth/callback. */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next"));
  const callbackURL = `/auth/callback?next=${encodeURIComponent(next)}`;

  let url: string | undefined;
  try {
    const result = await auth.api.signInSocial({
      body: { provider: "google", callbackURL, errorCallbackURL: "/login?error=google" },
    });
    url = result.url;
  } catch (error) {
    logger.warn("auth.google_start_failed", { name: errorName(error), status: isAPIError(error) ? error.statusCode : undefined });
  }
  if (!url) redirect("/login?error=google");
  redirect(url);
}

export async function signOut(): Promise<void> {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    logger.warn("auth.sign_out_failed", { name: errorName(error) });
  }
  redirect("/login");
}
