import { NextResponse } from "next/server";

import { adminStoresForExport } from "@/lib/admin/queries";
import { creatorsCsv } from "@/lib/admin/csv";
import { currentAdmin } from "@/lib/admin/guard";
import { logger } from "@/lib/logger";
import { csvResponseHeaders } from "@/lib/orders/export";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";

const NO_STORE = { "Cache-Control": "no-store" };

// Admin CSV of creators (D-116). Admins only (anyone else gets a 404); formulas are neutralized.
export async function GET() {
  const admin = await currentAdmin();
  if (!admin) return new NextResponse("Not found", { status: 404, headers: NO_STORE });
  if (!(await takeRateLimit(rateLimitKey("admin-export", admin.id), 20, 10))) return new NextResponse("Too many exports. Try again in a few minutes.", { status: 429, headers: NO_STORE });
  try {
    return new NextResponse(creatorsCsv(await adminStoresForExport()), { headers: csvResponseHeaders("pickstall-creators.csv") });
  } catch (error) {
    logger.error("admin.export_failed", { name: error instanceof Error ? error.name : undefined });
    return new NextResponse("Couldn't export. Try again.", { status: 500, headers: NO_STORE });
  }
}
