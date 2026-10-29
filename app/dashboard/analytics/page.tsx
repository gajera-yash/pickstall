import { Globe, Trophy } from "lucide-react";
import { Suspense } from "react";

import { KpiSection } from "@/components/dashboard/kpi-section";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";

const zeros = () => Array.from({ length: 90 }, () => 0);

// Analytics (D-029). Real numbers: zero until the first visit and sale (R4 and R6 record them).
export default function AnalyticsPage() {
  return (
    <>
      <PageHeader title="Analytics" description="How your store and products are doing." />
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
        <AnalyticsContent />
      </Suspense>
    </>
  );
}

async function AnalyticsContent() {
  const { store } = await requireCreator("/dashboard/analytics");
  return (
    <>
      <KpiSection currency={store.currency} series={{ revenueCents: zeros(), orders: zeros(), customers: zeros() }} />
      <div className="grid gap-4 lg:grid-cols-2">
        <EmptyState icon={Trophy} title="No top products yet">
          Your best-selling products are ranked here after your first sales.
        </EmptyState>
        <EmptyState icon={Globe} title="No traffic yet">
          See where visitors come from (Instagram, YouTube, search) once your store is live.
        </EmptyState>
      </div>
    </>
  );
}
