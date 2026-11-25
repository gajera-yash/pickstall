import { Suspense } from "react";

import { MarketingNav } from "@/components/dashboard/marketing-nav";
import { Skeleton } from "@/components/ui/skeleton";

// Marketing (D-129): a sub-nav over every marketing page, so each tool has its own calm page and
// the creator can move between them in one tap.
export default function MarketingLayout({ children }: LayoutProps<"/dashboard/marketing">) {
  return (
    <>
      {/* usePathname() is request data, so the sub-nav streams in behind a boundary. */}
      <Suspense fallback={<Skeleton className="h-11 w-full" />}>
        <MarketingNav />
      </Suspense>
      {children}
    </>
  );
}
