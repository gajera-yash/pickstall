import type { LeadExportRow } from "@/lib/marketing/leads";
import { LEAD_PLATFORM_LABELS, LEAD_STAGE_LABELS, LEAD_TOOL_LABELS, leadLink } from "@/lib/marketing/leads-rules";
import { buildCsv } from "@/lib/orders/csv";

// The outreach leads CSV (D-120), with the same columns as the founder's sheet plus each lead's link
// and store progress. `buildCsv` neutralizes spreadsheet formulas in every text cell (D-014).

export function leadsCsv(rows: LeadExportRow[], appUrl: string): string {
  return buildCsv(
    ["Name", "Handle", "Platform", "Followers", "Country", "Course topic", "Current tool", "Contact method", "Stage", "Notes", "Link", "Last contacted (UTC)", "Store", "Store live", "First sale", "Paid plan"],
    rows.map((row) => [
      row.name,
      row.handle,
      LEAD_PLATFORM_LABELS[row.platform],
      row.followers,
      row.country,
      row.topic,
      row.tool === "other" && row.toolLabel ? row.toolLabel : LEAD_TOOL_LABELS[row.tool],
      row.contactMethod,
      LEAD_STAGE_LABELS[row.stage],
      row.notes,
      leadLink(appUrl, row.refCode, row.platform),
      row.lastContactedAt?.toISOString() ?? "",
      row.store?.slug ?? "",
      row.store ? (row.store.steps.published ? "yes" : "no") : "",
      row.store ? (row.store.steps.firstSale ? "yes" : "no") : "",
      row.store ? (row.store.steps.paidPlan ? "yes" : "no") : "",
    ]),
  );
}
