import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";

/** Supabase client for Client Components. Uses the publishable key only; RLS applies. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
