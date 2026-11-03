import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { listOrdersForExport } from "@/lib/orders/creator-queries";
import { csvResponseHeaders, ordersCsv } from "@/lib/orders/export";
import { parseOrderParams } from "@/lib/orders/params";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { findStoreByOwner } from "@/lib/stores/queries";

// CSV export of the signed-in creator's orders with the Orders page filters (status, product,
// search) and a Status column. The store comes from the session; the filters are parsed like the
// page's. Shares the export rate limit with the customers export.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in to export.", { status: 401, headers: { "Cache-Control": "no-store" } });

  try {
    const store = await findStoreByOwner(user.id);
    if (!store) return new NextResponse("Create your store first.", { status: 403, headers: { "Cache-Control": "no-store" } });
    if (!(await takeRateLimit(rateLimitKey("export:owner", user.id), 10, 10))) {
      return new NextResponse("Too many exports. Try again in a few minutes.", { status: 429, headers: { "Cache-Control": "no-store" } });
    }

    const { status, q, product } = parseOrderParams(Object.fromEntries(request.nextUrl.searchParams));
    const orders = await listOrdersForExport(store.id, { status, q, product });
    return new NextResponse(ordersCsv(orders, { withStatus: true }), { headers: csvResponseHeaders(`${store.slug}-orders.csv`) });
  } catch (error) {
    logger.error("orders.export_failed", { name: error instanceof Error ? error.name : undefined });
    return new NextResponse("Couldn't export. Try again.", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
