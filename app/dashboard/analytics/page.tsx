import { Trophy } from "lucide-react";
import { Suspense } from "react";

import { KpiSection } from "@/components/dashboard/kpi-section";
import { PageHeader } from "@/components/dashboard/page-header";
import { SOURCE_PERIODS, SourcesCard, type SourcePeriod } from "@/components/dashboard/sources-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/products/money";
import { Skeleton } from "@/components/ui/skeleton";
import { storeLink } from "@/lib/config";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { incomeStats, salesBySource } from "@/lib/orders/creator-queries";

const zeros = () => Array.from({ length: 90 }, () => 0);

// Analytics (D-029). Real numbers: zero until the first visit and sale (R4 and R6 record them).
// "Where sales come from" (D-112) groups paid orders by the source saved at checkout.
export default function AnalyticsPage({ searchParams }: PageProps<"/dashboard/analytics">) {
  return (
    <>
      <PageHeader title="Analytics" description="How your store and products are doing." />
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
        <AnalyticsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AnalyticsContent({ searchParams }: Pick<PageProps<"/dashboard/analytics">, "searchParams">) {
  const [{ store }, query] = await Promise.all([requireUnlockedCreator("/dashboard/analytics"), searchParams]);
  const asked = Number(query.sources);
  const period: SourcePeriod = SOURCE_PERIODS.find((days) => days === asked) ?? 30;
  const [stats, sources] = await Promise.all([incomeStats(store.id, store.currency, 90).catch(() => null), salesBySource(store.id, store.currency, period).catch(() => null)]);
  return (
    <>
      <KpiSection currency={store.currency} series={stats ? stats.series : { revenueCents: zeros(), orders: zeros(), customers: zeros() }} />
      <SourcesCard rows={sources ?? []} error={sources === null} currency={store.currency} period={period} storeUrl={`https://${storeLink(store.slug)}`} />
      {stats && stats.topProducts.length > 0 ? (
        <Card className="gap-3">
          <h2 className="flex items-center gap-2 font-display text-h4">
            <Trophy aria-hidden="true" className="size-5 text-mute" />
            Top products (90 days)
          </h2>
          <ol className="flex flex-col divide-y divide-line">
            {stats.topProducts.map((product) => (
              <li key={product.productId} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 truncate font-medium">{product.title}</span>
                <span className="shrink-0 text-sm text-mute">
                  {product.orders} {product.orders === 1 ? "sale" : "sales"} · <span className="font-semibold text-ink tabular-nums">{formatMoney(product.revenueCents, store.currency)}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <EmptyState icon={Trophy} title="No top products yet">
          Your best-selling products are ranked here after your first sales.
        </EmptyState>
      )}
    </>
  );
}
