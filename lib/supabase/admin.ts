import "server-only";

import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env.server";

/**
 * Service-role client: bypasses RLS. Server code only (webhooks, jobs, trusted writes).
 * Never import from a Client Component, never log the key, and always check
 * authorization yourself before using it on behalf of a user.
 */
export function createSupabaseAdminClient() {
  return createClient(serverEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
