import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import { buildIcs } from "@/lib/coaching/ics";
import { findPurchase } from "@/lib/library/queries";
import { isUuid } from "@/lib/media/media";

// "Add to calendar" for a booked coaching call (D-084). Only the signed-in buyer of the order gets
// the file, and only while the call is confirmed and the order is not refunded.
export async function GET(_request: Request, { params }: RouteContext<"/library/[orderId]/call.ics">) {
  const { orderId } = await params;
  const user = await getCurrentUser();
  if (!user?.email) return new NextResponse("Sign in to add this call to your calendar.", { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!isUuid(orderId)) return new NextResponse("Not found.", { status: 404, headers: { "Cache-Control": "no-store" } });

  const purchase = await findPurchase(user.email, orderId).catch(() => null);
  const call = purchase?.call;
  if (!purchase || !call || call.status !== "confirmed" || purchase.status !== "paid") return new NextResponse("Not found.", { status: 404, headers: { "Cache-Control": "no-store" } });

  const ics = buildIcs({
    uid: purchase.orderId,
    start: call.start,
    end: call.end,
    title: `${purchase.title} with ${purchase.storeName}`,
    description: call.meetingUrl ? `Join: ${call.meetingUrl}` : `${purchase.storeName} will email you the meeting link before the call.`,
    url: call.meetingUrl,
    now: new Date(),
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="call.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
