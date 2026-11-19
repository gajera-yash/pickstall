import { storeLink } from "@/lib/config";
import { buildCsv } from "@/lib/orders/csv";
import { formatMoney } from "@/lib/products/money";
import type { ProductExportRow } from "@/lib/products/queries";

// Products CSV (D-100): what a creator needs to move or audit their catalog. Public fields only;
// cells are neutralized against spreadsheet formulas (D-014).

const TYPE_LABELS: Record<ProductExportRow["type"], string> = { digital: "Digital product", course: "Course", coaching: "Coaching call", lead_magnet: "Collect emails" };

export function productsCsv(rows: ProductExportRow[], store: { slug: string; currency: string }): string {
  return buildCsv(
    ["Title", "Type", "Status", "Price", "Discounted price", "Currency", "Link", "Created (UTC)"],
    rows.map((row) => [
      row.title,
      TYPE_LABELS[row.type] ?? row.type,
      row.status,
      row.priceCents === 0 ? "Free" : formatMoney(row.priceCents, store.currency),
      row.salePriceCents != null ? formatMoney(row.salePriceCents, store.currency) : "",
      store.currency.toUpperCase(),
      row.status === "published" ? `https://${storeLink(store.slug)}/${row.slug}` : "",
      row.createdAt.toISOString().slice(0, 19).replace("T", " "),
    ]),
  );
}
