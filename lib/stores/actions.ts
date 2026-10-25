"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/guards";
import { ACTIVATE_PATH, DASHBOARD_PATH } from "@/lib/auth/post-login";
import { loginPath } from "@/lib/auth/redirect";
import { logger } from "@/lib/logger";
import { err, type Result } from "@/lib/result";
import { SLUG_TAKEN_MESSAGE } from "@/lib/slug";
import { createStoreInput } from "@/lib/stores/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateStoreState = Result<never> | null;

/**
 * Store basics step: creates the signed-in user's store. Runs as the user (not the service role),
 * so row-level security decides: a user can only create a store they own, and cannot set the
 * Stripe or domain columns. A database trigger then marks them as a creator.
 * The unique constraints are the final word on usernames and on one store per user.
 */
export async function createStore(_prev: CreateStoreState, formData: FormData): Promise<CreateStoreState> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath("/onboarding"));

  const parsed = createStoreInput.safeParse({
    name: formData.get("name") ?? "",
    username: formData.get("username") ?? "",
    currency: formData.get("currency") ?? "",
    bio: formData.get("bio") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;
    return err(issue?.message ?? "Check the form and try again.", field);
  }
  const { name, username, currency, bio } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("stores")
    .insert({ owner_id: user.id, slug: username, name, currency, bio: bio ?? null });

  if (error) {
    if (error.code === "23505") {
      // Already has a store (for example a second tab): nothing to create, go on.
      if (error.message.includes("stores_owner_id_key")) redirect(DASHBOARD_PATH);
      return err(SLUG_TAKEN_MESSAGE, "username");
    }
    logger.error("stores.create_failed", { code: error.code });
    return err("Couldn't create your store. Check your connection and try again.");
  }

  redirect(ACTIVATE_PATH);
}
