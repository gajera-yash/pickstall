import { NextResponse, type NextRequest } from "next/server";

import { completeSignup } from "@/lib/auth/complete-signup";
import { getCurrentUser } from "@/lib/auth/guards";
import { appOriginFrom } from "@/lib/app-origin";

// Landing page after Google sign-in. Better Auth has already checked the OAuth `state`, created
// the session cookie (/api/auth/callback/google) and sent the user here. Redirects are built from
// NEXT_PUBLIC_APP_URL (in development also a local or LAN host, D-041), and `next` must be a same-origin path.
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const origin = appOriginFrom(request.headers);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login?error=callback", origin));

  const path = await completeSignup(user, next);
  return NextResponse.redirect(new URL(path, origin));
}
