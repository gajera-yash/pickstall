import { NextResponse, type NextRequest } from "next/server";

import { appOriginFrom } from "@/lib/app-origin";
import { getCurrentUser } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { openFileForDownload } from "@/lib/files/product-files";
import { attachmentHeader } from "@/lib/files/types";
import { grantAccess } from "@/lib/library/queries";
import { isUuid } from "@/lib/media/media";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";

// Opens a purchase (R7): POST only, so a link preview or prefetch can never use up a download.
// The destination comes from the database, never from the request, so this is not an open redirect.
export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const base = new URL(appOriginFrom(request.headers));
  const back = (query = "") => NextResponse.redirect(new URL(`/library/${isUuid(orderId) ? orderId : ""}${query}`, base), 303);

  // Same-origin only: a form on another site cannot trigger this.
  const origin = request.headers.get("origin");
  if (origin && origin !== base.origin) return new NextResponse("Forbidden", { status: 403 });

  const user = await getCurrentUser();
  if (!user?.email) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/library/${orderId}`)}`, base), 303);
  if (!isUuid(orderId)) return NextResponse.redirect(new URL("/library", base), 303);

  try {
    if (!(await takeRateLimit(rateLimitKey("library-open:user", user.id), 30, 10))) return back("?problem=slow");

    const access = await grantAccess(user.email, orderId);
    if (!access.ok) return back(`?problem=${access.reason}`);

    if (access.kind === "file") {
      // Only for this buyer, after the checks above: a 60-second signed link to the private R2
      // bucket (D-093), or the bytes streamed from the disk (D-050).
      const file = await openFileForDownload(access.storeId, access.fileId);
      if (!file) return back("?problem=unavailable");
      if (file.kind === "redirect") return NextResponse.redirect(file.url, { status: 303, headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "private, no-store" } });
      return new Response(file.stream, {
        headers: {
          "Content-Type": file.mime,
          "Content-Length": String(file.size),
          "Content-Disposition": attachmentHeader(file.name),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
          "Referrer-Policy": "no-referrer",
        },
      });
    }

    // The link was validated as https when the creator saved it; check again before leaving.
    const target = new URL(access.url);
    if (target.protocol !== "https:") return back("?problem=unavailable");
    return NextResponse.redirect(target, { status: 303, headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("library.open_failed", { name: error instanceof Error ? error.name : undefined });
    return back("?problem=error");
  }
}
