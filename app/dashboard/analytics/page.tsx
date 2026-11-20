import { Trophy } from "lucide-react";
import { Suspense } from "react";

import { KpiSection } from "@/components/dashboard/kpi-section";
import { PageHeader } from "@/components/dashboard/page-header";
import { SOURCE_PERIODS, SourcesCard, type SourcePeriod } from "@/components/dashboard/sources-card";
import { EmptyState } from "@/components/ui/empty-state";
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
      <EmptyState icon={Trophy} title="No top products yet">
        Your best-selling products are ranked here after your first sales.
      </EmptyState>
    </>
  );
}
