import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_CURRENCY } from "@/lib/config";
import { logger } from "@/lib/logger";
import { STORE_NAME_MAX_LENGTH } from "@/lib/stores/schemas";

export type DraftStoreResult = "created" | "taken" | "has_store" | "error";

/**
 * Creates the user's draft (unpublished) store with THEIR OWN session, so row-level security
 * applies: only a store they own, no Stripe or domain columns. The database trigger then marks
 * them as a creator. The unique constraints decide taken usernames and one store per user.
 */
export async function createDraftStore(
  supabase: SupabaseClient,
  ownerId: string,
  username: string,
  name: string,
): Promise<DraftStoreResult> {
  const storeName = name.trim().slice(0, STORE_NAME_MAX_LENGTH).trim() || username;
  const { error } = await supabase
    .from("stores")
    .insert({ owner_id: ownerId, slug: username, name: storeName, currency: DEFAULT_CURRENCY });

  if (!error) return "created";
  if (error.code === "23505") return error.message.includes("stores_owner_id_key") ? "has_store" : "taken";
  logger.error("stores.create_draft_failed", { code: error.code });
  return "error";
}
