import { Globe } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DIRECT_SOURCE } from "@/lib/analytics/attribution";
import type { SourceRow } from "@/lib/orders/creator-queries";
import { formatMoney } from "@/lib/products/money";
import { cn } from "@/lib/utils";

export const SOURCE_PERIODS = [30, 90] as const;
export type SourcePeriod = (typeof SOURCE_PERIODS)[number];

const sourceLabel = (source: string) => (source === DIRECT_SOURCE ? "Direct or unknown" : source);

/** Paid sales by source (D-112): where buyers came from, with a 30 / 90 day switch. */
export function SourcesCard({ rows, currency, period, storeUrl, error = false }: { rows: SourceRow[]; currency: string; period: SourcePeriod; storeUrl: string; error?: boolean }) {
  const total = rows.reduce((sum, row) => sum + row.orders, 0);
  return (
    <Card className="gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-h4">Where sales come from</h2>
          <p className="text-sm text-mute">Paid orders in the last {period} days, by source. Free orders are not counted.</p>
        </div>
        <nav aria-label="Period" className="flex rounded-md border border-line p-0.5">
          {SOURCE_PERIODS.map((days) => (
            <Link
              key={days}
              href={`/dashboard/analytics?sources=${days}`}
              scroll={false}
              aria-current={days === period ? "page" : undefined}
              className={cn("rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors duration-(--dur-fast)", days === period ? "bg-blue-soft text-ink" : "text-mute hover:text-ink")}
            >
              {days} days
            </Link>
          ))}
        </nav>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          Couldn&apos;t load your sources. Reload the page to try again.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Globe} title="No sales to show yet">
          Sales appear here by source (Instagram, YouTube, a campaign) once buyers pay.
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead className="hidden sm:table-cell">Top campaign</TableHead>
              <TableHead numeric>Orders</TableHead>
              <TableHead numeric>Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.source}>
                <TableCell>
                  <span className="flex min-w-0 flex-col">
                    <span className={cn("truncate font-semibold", row.source !== DIRECT_SOURCE && "capitalize")}>{sourceLabel(row.source)}</span>
                    <span className="text-xs text-mute">{total > 0 ? Math.round((row.orders / total) * 100) : 0}% of orders</span>
                  </span>
                </TableCell>
                <TableCell className="hidden max-w-48 truncate text-mute sm:table-cell">{row.topCampaign ?? "None"}</TableCell>
                <TableCell numeric>{row.orders}</TableCell>
                <TableCell numeric>{formatMoney(row.revenueCents, currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <p className="text-xs text-mute">
        Tip: add tags to the links you share, for example <code className="font-mono break-all">{storeUrl}?utm_source=instagram&amp;utm_campaign=launch</code>. Visits without tags are counted by the site that sent them, when the browser says.
      </p>
    </Card>
  );
}
