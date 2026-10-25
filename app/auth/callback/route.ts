import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/auth/redirect";
import { publicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// OAuth (Google) return URL: exchanges the one-time code for a session cookie.
// Redirects are built from NEXT_PUBLIC_APP_URL, never from the request Host header,
// and `next` must be a same-origin path.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, publicEnv.NEXT_PUBLIC_APP_URL));
    logger.warn("auth.callback_exchange_failed", { status: error.status, code: error.code });
  }

  return NextResponse.redirect(new URL("/login?error=callback", publicEnv.NEXT_PUBLIC_APP_URL));
}
