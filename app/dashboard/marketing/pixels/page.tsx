import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PixelSettings } from "@/components/dashboard/pixel-settings";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { findPixelSettings } from "@/lib/pixels/queries";

// Ad pixels (D-097) on their own page (D-129).
export default function PixelsPage() {
  return (
    <>
      <PageHeader title="Pixels" description="Measure your ads: page views, checkouts and purchases on your store. Visitors are asked first." />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
        <PixelsContent />
      </Suspense>
    </>
  );
}

async function PixelsContent() {
  const { store } = await requireUnlockedCreator("/dashboard/marketing/pixels");
  return <PixelSettings initial={await findPixelSettings(store.id)} />;
}
