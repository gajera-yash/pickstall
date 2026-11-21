import { NextResponse, type NextRequest } from "next/server";

import { appOriginFrom } from "@/lib/app-origin";
import { getCurrentUser } from "@/lib/auth/guards";
import { loginPath } from "@/lib/auth/redirect";
import { syncPayPalReturn } from "@/lib/plans/paypal-billing";

// Back from PayPal after approving a plan subscription (D-118). Thin: the signed-in creator, then the
// subscription is fetched from PayPal (only if it was started for this store) and saved. The webhook
// does the same, so whichever comes first wins and the other changes nothing.
export async function GET(request: NextRequest) {
  const origin = appOriginFrom(request.headers);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(loginPath("/dashboard/settings/plan"), origin));
  const outcome = await syncPayPalReturn(user.id, request.nextUrl.searchParams.get("subscription_id"));
  return NextResponse.redirect(new URL(`/dashboard/settings/plan?billing=${outcome}`, origin));
}
