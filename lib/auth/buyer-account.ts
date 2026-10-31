import "server-only";

import { auth } from "@/lib/auth/auth";
import { saveProfile } from "@/lib/auth/profiles";

export type CreatePasswordResult = { ok: true; userId: string } | { ok: false; reason: "has_password" };

/**
 * Gives a buyer a password login for the email they paid with (D-037). Public sign-up stays off;
 * this runs only after the order email's one-time link has been checked, which is what proves the
 * buyer owns that email. An existing user (a creator, or someone who signed in with a code) keeps
 * their account and gets a password added. An account that already has a password is not changed.
 */
export async function createBuyerPassword(input: { email: string; name: string; password: string }): Promise<CreatePasswordResult> {
  const email = input.email.trim().toLowerCase();
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(input.password);

  const found = await ctx.internalAdapter.findUserByEmail(email);
  let userId: string;
  if (found?.user) {
    const accounts = await ctx.internalAdapter.findAccounts(found.user.id);
    if (accounts.some((account) => account.providerId === "credential")) return { ok: false, reason: "has_password" };
    userId = found.user.id;
  } else {
    const user = await ctx.internalAdapter.createUser({ email, name: input.name, emailVerified: true }, { method: "email-password" });
    userId = user.id;
    await saveProfile(userId, email, { fullName: input.name });
  }

  await ctx.internalAdapter.linkAccount({ userId, providerId: "credential", accountId: userId, password: hash });
  return { ok: true, userId };
}
