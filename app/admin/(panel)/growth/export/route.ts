import { NextResponse } from "next/server";

import { currentAdmin } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/audit/log";
import { publicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { leadsForExport } from "@/lib/marketing/leads";
import { leadsCsv } from "@/lib/marketing/leads-csv";
import { csvResponseHeaders } from "@/lib/orders/export";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";

const NO_STORE = { "Cache-Control": "no-store" };

// Admin CSV of outreach leads (D-120). Admins only (anyone else gets a 404); formulas are neutralized;
// each download goes to the audit log with the number of rows.
export async function GET() {
  const admin = await currentAdmin();
  if (!admin) return new NextResponse("Not found", { status: 404, headers: NO_STORE });
  if (!(await takeRateLimit(rateLimitKey("admin-export", admin.id), 20, 10))) return new NextResponse("Too many exports. Try again in a few minutes.", { status: 429, headers: NO_STORE });
  try {
    const rows = await leadsForExport();
    await recordAudit({ actorId: admin.id, action: "admin.leads_exported", meta: { rows: rows.length }, ipHash: await getClientIpHash().catch(() => null) });
    return new NextResponse(leadsCsv(rows, publicEnv.NEXT_PUBLIC_APP_URL), { headers: csvResponseHeaders("pickstall-leads.csv") });
  } catch (error) {
    logger.error("admin.leads_export_failed", { name: error instanceof Error ? error.name : undefined });
    return new NextResponse("Couldn't export. Try again.", { status: 500, headers: NO_STORE });
  }
}
