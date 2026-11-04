import { NextResponse, type NextRequest } from "next/server";

import { appOriginFrom } from "@/lib/app-origin";
import { getCurrentUser } from "@/lib/auth/guards";
import { loginPath } from "@/lib/auth/redirect";
import { completeStripeConnect } from "@/lib/stores/stripe-connect";

// Stripe Connect OAuth return (D-053). Thin: the signed-in user, then lib/stores/stripe-connect.ts
// checks the one-time state and saves the account on the user's own store.
export async function GET(request: NextRequest) {
  const origin = appOriginFrom(request.headers);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(loginPath("/dashboard/settings/payments"), origin));

  const params = request.nextUrl.searchParams;
  const path = await completeStripeConnect(user.id, {
    state: params.get("state") ?? undefined,
    code: params.get("code") ?? undefined,
    error: params.get("error") ?? undefined,
  });
  return NextResponse.redirect(new URL(path, origin));
}
