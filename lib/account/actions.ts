"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fullNameSchema } from "@/lib/auth/schemas";
import { requireCreator } from "@/lib/auth/guards";
import { saveProfile } from "@/lib/auth/profiles";
import { logger } from "@/lib/logger";
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
