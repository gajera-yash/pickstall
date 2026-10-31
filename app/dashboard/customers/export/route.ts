import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { buildCsv } from "@/lib/orders/csv";
import { listPaidOrdersForExport } from "@/lib/orders/creator-queries";
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
    // One column per distinct question label, so the answers line up in a spreadsheet.
    const labels = [...new Set(orders.flatMap((order) => order.answers.map((answer) => answer.label)))];
    const csv = buildCsv(
      ["Date (UTC)", "Name", "Email", "Product", "Amount", "Currency", "Order", "Test order", ...labels],
      orders.map((order) => [
        order.createdAt.toISOString().slice(0, 10),
        order.buyerName,
        order.buyerEmail,
        order.title,
        (order.totalCents / 100).toFixed(2),
        order.currency.toUpperCase(),
        order.id,
        order.provider === "mock" ? "yes" : "no",
        ...labels.map((label) => order.answers.find((answer) => answer.label === label)?.value ?? ""),
      ]),
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${store.slug}-customers.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logger.error("customers.export_failed", { name: error instanceof Error ? error.name : undefined });
    return new NextResponse("Couldn't export. Try again.", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
