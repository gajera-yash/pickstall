import type { Metadata } from "next";
import { Suspense } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";
import { DASHBOARD_PATH } from "@/lib/auth/post-login";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Dashboard | ${APP_NAME}`, robots: { index: false } };

// App shell (DESIGN.md 5.3, 10.2): sidebar 248px on desktop, bottom tab bar on mobile, 64px top bar.
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="hidden w-62 shrink-0 flex-col gap-8 border-r border-line px-4 py-5 md:flex">
        <Wordmark className="px-3" />
        <DashboardNav variant="sidebar" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-line px-4 md:px-6">
          <Wordmark className="md:hidden" />
          {/* The store name is request data, so it streams in behind a boundary. */}
          <Suspense fallback={<Skeleton className="h-5 w-40" />}>
            <StoreStatus />
          </Suspense>
        </header>
        <main id="main" className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 py-6 md:px-6">
          {children}
        </main>
      </div>

      <DashboardNav variant="bottom" />
    </div>
  );
}

async function StoreStatus() {
  const { store } = await requireCreator(DASHBOARD_PATH);
  return (
    <p className="flex min-w-0 items-center gap-2 md:ml-auto">
      <span className="truncate font-semibold">{store.name}</span>
      {store.is_published ? <Badge variant="live">Live</Badge> : <Badge variant="draft">Draft</Badge>}
    </p>
  );
}
