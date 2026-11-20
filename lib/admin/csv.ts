import type { AdminStoreRow } from "@/lib/admin/queries";
import { buildCsv } from "@/lib/orders/csv";
import { centsToInput } from "@/lib/products/money";

// Admin CSV exports (D-116). `buildCsv` neutralizes spreadsheet formulas in every text cell (D-014).

function planLabel(row: AdminStoreRow): string {
  if (row.access.plan) return row.access.state === "past_due" ? `${row.access.plan} (past due)` : row.access.plan;
  return row.access.state;
}

export function creatorsCsv(rows: AdminStoreRow[]): string {
  return buildCsv(
    ["Store", "Username", "Owner email", "Plan", "Published", "Stripe connected", "Created (UTC)"],
    rows.map((row) => [row.name, row.slug, row.ownerEmail, planLabel(row), row.isPublished ? "yes" : "no", row.stripeConnected ? "yes" : "no", row.createdAt.toISOString()]),
  );
}

export function planPaymentsCsv(rows: { id: string; paidAt: Date; storeName: string; slug: string; plan: string; amountCents: number; currency: string }[]): string {
  return buildCsv(
    ["Paid (UTC)", "Store", "Username", "Plan", "Amount", "Currency", "Stripe invoice"],
    rows.map((row) => [row.paidAt.toISOString(), row.storeName, row.slug, row.plan, centsToInput(row.amountCents, row.currency), row.currency.toUpperCase(), row.id]),
  );
}
