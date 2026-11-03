import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { listPaidOrdersForExport } from "@/lib/orders/creator-queries";
import { csvResponseHeaders, ordersCsv } from "@/lib/orders/export";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { findStoreByOwner } from "@/lib/stores/queries";

// CSV export of the signed-in creator's paid orders with buyer details and checkout answers (PRD F12).
// The store comes from the session. Text cells are neutralized against spreadsheet formulas (D-014).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in to export.", { status: 401, headers: { "Cache-Control": "no-store" } });

  try {
    const store = await findStoreByOwner(user.id);
    if (!store) return new NextResponse("Create your store first.", { status: 403, headers: { "Cache-Control": "no-store" } });
    if (!(await takeRateLimit(rateLimitKey("export:owner", user.id), 10, 10))) {
      return new NextResponse("Too many exports. Try again in a few minutes.", { status: 429, headers: { "Cache-Control": "no-store" } });
    }

    const orders = await listPaidOrdersForExport(store.id);
    return new NextResponse(ordersCsv(orders, { withStatus: false }), { headers: csvResponseHeaders(`${store.slug}-customers.csv`) });
  } catch (error) {
    logger.error("customers.export_failed", { name: error instanceof Error ? error.name : undefined });
    return new NextResponse("Couldn't export. Try again.", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
