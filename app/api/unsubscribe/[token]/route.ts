import { NextResponse, type NextRequest } from "next/server";

import { appOriginFrom } from "@/lib/app-origin";
import { logger } from "@/lib/logger";
import { isUnsubscribeToken, unsubscribeByToken } from "@/lib/subscribers/unsubscribe";

const NO_STORE = { "Cache-Control": "no-store" };

// Unsubscribe (D-095). Two callers:
// - Mail apps' one-click button (RFC 8058): a POST with "List-Unsubscribe=One-Click". It must
//   unsubscribe at once and answer 200 with an empty body.
// - The button on /u/<token>: the same POST with from=page, then back to that page.
// The random token is the only key; an unknown token changes nothing and says nothing.
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let fromPage = false;
  try {
    const form = await request.formData();
    fromPage = form.get("from") === "page";
  } catch {
    // A body that is not a form still counts as a one-click request.
  }
  if (isUnsubscribeToken(token)) {
    try {
      await unsubscribeByToken(token, "user");
    } catch (error) {
      logger.error("subscribers.unsubscribe_failed", { name: error instanceof Error ? error.name : undefined });
      return new NextResponse(null, { status: 500, headers: NO_STORE });
    }
  }
  if (fromPage && isUnsubscribeToken(token)) return NextResponse.redirect(new URL(`/u/${token}?done=1`, appOriginFrom(request.headers)), { status: 303, headers: NO_STORE });
  return new NextResponse(null, { status: 200, headers: NO_STORE });
}
