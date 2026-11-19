import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { csvResponseHeaders } from "@/lib/orders/export";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { findStoreByOwner } from "@/lib/stores/queries";
import { listSubscribersForExport } from "@/lib/subscribers/queries";
import { subscribersCsv } from "@/lib/subscribers/rules";

const NO_STORE = { "Cache-Control": "no-store" };

// CSV export of the signed-in creator's email list (D-094). The store comes from the session; text
// cells are neutralized against spreadsheet formulas (D-014).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in to export.", { status: 401, headers: NO_STORE });
  try {
    const store = await findStoreByOwner(user.id);
    if (!store) return new NextResponse("Create your store first.", { status: 403, headers: NO_STORE });
    if (!(await takeRateLimit(rateLimitKey("export:owner", user.id), 10, 10))) return new NextResponse("Too many exports. Try again in a few minutes.", { status: 429, headers: NO_STORE });
    const rows = await listSubscribersForExport(store.id);
    return new NextResponse(subscribersCsv(rows), { headers: csvResponseHeaders(`${store.slug}-subscribers.csv`) });
  } catch (error) {
    logger.error("subscribers.export_failed", { name: error instanceof Error ? error.name : undefined });
    return new NextResponse("Couldn't export. Try again.", { status: 500, headers: NO_STORE });
  }
}
