import { buildCsv } from "@/lib/orders/csv";
import type { OrderRow } from "@/lib/orders/creator-queries";
import { centsToInput } from "@/lib/products/money";

// CSV files for the Orders and Customers exports (PRD F12). Every text cell goes through buildCsv,
// which neutralizes spreadsheet formulas (D-014). Amounts use the currency's own decimals.

/** Orders as CSV, one column per distinct checkout question so the answers line up. */
export function ordersCsv(orders: OrderRow[], options: { withStatus: boolean }): string {
  const labels = [...new Set(orders.flatMap((order) => order.answers.map((answer) => answer.label)))];
  return buildCsv(
    ["Date (UTC)", "Name", "Email", "Product", "Amount", "Currency", ...(options.withStatus ? ["Status"] : []), "Order", "Test order", ...labels],
    orders.map((order) => [
      order.createdAt.toISOString().slice(0, 10),
      order.buyerName,
      order.buyerEmail,
      order.title,
      centsToInput(order.totalCents, order.currency),
      order.currency.toUpperCase(),
      ...(options.withStatus ? [order.status] : []),
      order.id,
      order.provider === "mock" ? "yes" : "no",
      ...labels.map((label) => order.answers.find((answer) => answer.label === label)?.value ?? ""),
    ]),
  );
}

export function csvResponseHeaders(fileName: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
