import { ArrowLeft, Filter } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { can } from "@/lib/plans/access";
import { formatMoney } from "@/lib/products/money";
import { funnelStats } from "@/lib/upsells/queries";
import { cn } from "@/lib/utils";

// Funnels (D-115): for each product with an after-purchase offer, how many buyers took the upsell
// and the downsell. Counts come from paid orders only; offer views are not tracked. Only the
// signed-in creator's store.
const PATH = "/dashboard/marketing/funnels";
const PERIODS = [30, 90] as const;

export default function FunnelsPage({ searchParams }: PageProps<"/dashboard/marketing/funnels">) {
  return (
    <>
      <Link href="/dashboard/marketing" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Marketing
      </Link>
      <PageHeader title="Funnels" description="Sale, then upsell, then downsell: how many buyers take each offer." />
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
        <FunnelsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "None");

async function FunnelsContent({ searchParams }: Pick<PageProps<"/dashboard/marketing/funnels">, "searchParams">) {
  const [{ store }, query] = await Promise.all([requireUnlockedCreator(PATH), searchParams]);
  const asked = Number(query.days);
  const days = PERIODS.find((value) => value === asked) ?? 30;
  const rows = await funnelStats(store.id, store.currency, days).catch(() => null);
  const money = (cents: number) => formatMoney(cents, store.currency);

  return (
    <Card className="gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mute">Paid orders in the last {days} days. Set the upsell and downsell on each product, in its Checkout or Publish step.</p>
        <nav aria-label="Period" className="flex rounded-md border border-line p-0.5">
          {PERIODS.map((value) => (
            <Link
              key={value}
              href={`${PATH}?days=${value}`}
              scroll={false}
              aria-current={value === days ? "page" : undefined}
              className={cn("rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors duration-(--dur-fast)", value === days ? "bg-blue-soft text-ink" : "text-mute hover:text-ink")}
            >
              {value} days
            </Link>
          ))}
        </nav>
      </div>

      {!can(store.access, "upsells") && (
        <p className="text-sm text-mute">
          Upsells and downsells are part of Pro.{" "}
          <a href="/dashboard/settings/plan" className="font-semibold text-blue underline underline-offset-4">
            Upgrade your plan
          </a>{" "}
          to offer them.
        </p>
      )}

      {rows === null ? (
        <p role="alert" className="text-sm text-danger">
          Couldn&apos;t load your funnels. Reload the page to try again.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Filter} title="No funnels yet">
          Add an upsell (and a downsell) to a product. Its numbers appear here after the first sales.
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead numeric>Sales</TableHead>
              <TableHead numeric>Upsell taken</TableHead>
              <TableHead numeric>Downsell taken</TableHead>
              <TableHead numeric>Offer revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.productId}>
                <TableCell>
                  <span className="flex min-w-0 flex-col">
                    <Link href={`/dashboard/products/${row.productId}`} className="truncate font-semibold hover:underline">
                      {row.title}
                    </Link>
                    <span className="text-xs text-mute">{money(row.salesCents)} from sales</span>
                  </span>
                </TableCell>
                <TableCell numeric>{row.sales}</TableCell>
                <TableCell numeric>
                  {row.upsells} <span className="text-xs text-mute">({percent(row.upsells, row.sales)})</span>
                </TableCell>
                <TableCell numeric>
                  {row.downsells} <span className="text-xs text-mute">({percent(row.downsells, row.sales)})</span>
                </TableCell>
                <TableCell numeric>{money(row.upsellCents + row.downsellCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="text-xs text-mute">Percentages are of the product&apos;s sales in the period. How many buyers saw each offer is not counted.</p>
    </Card>
  );
}
