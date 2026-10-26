import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { USERNAME_PATH } from "@/lib/auth/post-login";
import { loginPath } from "@/lib/auth/redirect";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthUser = { id: string; email: string | null };

export type CreatorStore = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  stripe_charges_enabled: boolean;
  is_published: boolean;
};

/**
 * The signed-in user from a verified JWT (`getClaims`), or null. Never trusts unverified
 * cookie contents. Cached per request, so several guards cost one check.
 * With Cache Components, call this only inside a <Suspense> boundary.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return { id: data.claims.sub, email: data.claims.email ?? null };
});

/** Signed-in user, or a redirect to /login (with `next` so they come back here). */
export async function requireUser(next?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(next));
  return user;
}

/**
 * Signed-in user who owns a store (docs/DECISIONS.md D-003), or a redirect to /login or
 * the username step. The store query runs as the user, so RLS only ever returns their own store.
 */
export async function requireCreator(next?: string): Promise<{ user: AuthUser; store: CreatorStore }> {
  const user = await requireUser(next);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id, slug, name, bio, avatar_url, stripe_charges_enabled, is_published")
    .eq("owner_id", user.id)
    .maybeSingle<CreatorStore>();

  if (error) {
    logger.error("auth.require_creator_store_query_failed", { code: error.code });
    throw new Error("Could not load your store.");
  }
  if (!data) redirect(USERNAME_PATH);
  return { user, store: data };
}
