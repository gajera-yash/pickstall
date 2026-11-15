"use server";

import { isAPIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";
import { fullNameSchema } from "@/lib/auth/schemas";
import { requireCreator, requireUser } from "@/lib/auth/guards";
import { saveProfile } from "@/lib/auth/profiles";
import { logger } from "@/lib/logger";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { optionalPhoneSchema } from "@/lib/phone";
import { err, ok, type Result } from "@/lib/result";

export type AccountState = Result<{ savedAt: number }> | null;

const accountInput = z.object({ fullName: fullNameSchema, phone: optionalPhoneSchema });

/**
 * Settings > Account (PRD F8): the creator's name and phone. The email is the sign-in identity and
 * is not editable here. The profile is keyed by the session's user id, never by a form field.
 */
export async function saveAccount(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const { user } = await requireCreator("/dashboard/settings/account");

  const parsed = accountInput.safeParse({ fullName: formData.get("fullName") ?? "", phone: formData.get("phone") ?? "" });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;
    return err(issue?.message ?? "Check the form and try again.", field);
  }

  if (!user.email) return err("Your account has no email address. Sign out and sign in again.");

  try {
    await saveProfile(user.id, user.email, { fullName: parsed.data.fullName, phone: parsed.data.phone ?? null });
  } catch (error) {
    logger.error("account.save_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save your account. Check your connection and try again.");
  }

  revalidatePath("/dashboard", "layout");
  return ok({ savedAt: Date.now() });
}

export type DeleteAccountState = Result<never> | null;

/**
 * Settings > Account > Delete account (D-074). The person types DELETE to confirm. Better Auth then
 * checks the session is fresh (signed in within a day), runs our cleanup (lib/account/delete-account.ts)
 * and deletes the user and every session. Works for creators and for buyers without a store.
 */
export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const user = await requireUser("/dashboard/settings/account");
  if (formData.get("confirm") !== "DELETE") return err("Type DELETE in capital letters to confirm.", "confirm");
  if (!(await takeRateLimit(rateLimitKey("account-delete:user", user.id), 5, 60))) return err("Too many attempts. Please wait an hour.");

  try {
    await auth.api.deleteUser({ headers: await headers(), body: {} });
  } catch (error) {
    if (isAPIError(error)) {
      const message = error.message ?? "";
      // Better Auth: the session is older than a day. Signing in again proves it is really you.
      if (/session expired/i.test(message)) return err("For your safety, please sign out, sign in again with your email code, and then delete your account.");
      if (message) return err(message);
    }
    logger.error("account.delete_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Your account could not be deleted. Please try again.");
  }
  redirect("/account/deleted");
}
