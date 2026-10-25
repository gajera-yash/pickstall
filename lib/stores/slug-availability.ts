import "server-only";

import { logger } from "@/lib/logger";
import { err, ok, type Result } from "@/lib/result";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Is this username already used by a store (published or not)? Uses the service role because
 * unpublished stores are hidden from visitors by RLS. Returns only a yes/no, nothing about the owner.
 * Not a guarantee: the database unique constraint decides when the store is created.
 */
export async function isSlugTaken(slug: string): Promise<Result<boolean>> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("stores").select("id").eq("slug", slug).maybeSingle();
  if (error) {
    logger.error("stores.slug_check_failed", { code: error.code });
    return err("Couldn't check that username. Try again.", "username");
  }
  return ok(data !== null);
}
