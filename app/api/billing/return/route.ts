import { NextResponse, type NextRequest } from "next/server";

import { appOriginFrom } from "@/lib/app-origin";
import { getCurrentUser } from "@/lib/auth/guards";
import { loginPath } from "@/lib/auth/redirect";
import { syncCheckoutReturn } from "@/lib/plans/billing-sync";

// Back from Stripe Checkout after subscribing (D-073). Thin: the signed-in creator's store, then the
// subscription is fetched from Stripe (only if that Checkout belongs to this store) and saved. The
// webhook does the same, so whichever comes first wins and the other changes nothing.
export async function GET(request: NextRequest) {
  const origin = appOriginFrom(request.headers);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(loginPath("/dashboard/settings/plan"), origin));
  const outcome = await syncCheckoutReturn(user.id, request.nextUrl.searchParams.get("session_id"));
  return NextResponse.redirect(new URL(`/dashboard/settings/plan?billing=${outcome}`, origin));
}
