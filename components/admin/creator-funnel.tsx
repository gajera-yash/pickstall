import { Filter } from "lucide-react";

import { Stat } from "@/components/admin/admin-ui";
import { ListCard } from "@/components/dashboard/orders-ui";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { creatorFunnel, type FunnelCounts } from "@/lib/marketing/funnel";

const DAYS = 30;

function percent(part: number, whole: number): string {
  return whole === 0 ? "-" : `${Math.round((part / whole) * 100)}%`;
}

const STEPS: { key: keyof FunnelCounts; label: string }[] = [
  { key: "signups", label: "Signups" },
  { key: "published", label: "Published" },
  { key: "paymentConnected", label: "Payments" },
  { key: "firstSale", label: "First sale" },
  { key: "paidPlan", label: "Paid plan" },
];

/** Creators who signed up in the last 30 days and how far they got, overall and by source (D-119). */
export async function CreatorFunnelSection() {
  await requireAdmin();
  const funnel = await creatorFunnel(DAYS);
  const { total } = funnel;
  return (
    <section aria-labelledby="funnel-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="funnel-title" className="font-display text-h4">
          Creator funnel, {DAYS} days
        </h2>
        <p className="text-sm text-mute">Creators who signed up in the last {DAYS} days and how far each got. Source is the link they signed up from.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {STEPS.map((step) => (
          <Stat key={step.key} label={step.label} value={total[step.key].toLocaleString("en")} hint={step.key === "signups" ? undefined : `${percent(total[step.key], total.signups)} of signups`} />
        ))}
      </div>
      {funnel.bySource.length === 0 ? (
        <EmptyState icon={Filter} title="No signups yet">
          Creators who sign up in the next {DAYS} days appear here, grouped by the link they came from.
        </EmptyState>
      ) : (
        <ListCard>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Source</TableHead>
                {STEPS.map((step) => (
                  <TableHead key={step.key} className="text-right">
                    {step.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {funnel.bySource.map((row) => (
                <TableRow key={row.source}>
                  <TableCell className="max-w-48 truncate font-semibold">{row.source}</TableCell>
                  {STEPS.map((step) => (
                    <TableCell key={step.key} className="text-right whitespace-nowrap tabular-nums">
                      {row[step.key].toLocaleString("en")}
                      {step.key !== "signups" && <span className="ml-1 text-xs text-mute">{percent(row[step.key], row.signups)}</span>}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ListCard>
      )}
    </section>
  );
}
