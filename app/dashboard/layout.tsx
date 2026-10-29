import type { Metadata } from "next";
import { Suspense } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { TopBar } from "@/components/dashboard/top-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";
import { DASHBOARD_PATH } from "@/lib/auth/post-login";
import { getProfile } from "@/lib/auth/profiles";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Dashboard | ${APP_NAME}`, robots: { index: false } };

// App shell (DESIGN.md 5, 10.2): 240px sidebar on desktop, bottom tab bar on mobile (D-023, D-028),
// 56px top bar, content max 1120px on the --bg-subtle page with white cards.
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex min-h-dvh flex-1 bg-bg-subtle">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface px-3 py-4 md:flex">
        <Wordmark className="h-9 self-start px-3" priority />
        <DashboardNav variant="sidebar" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        {/* The account and store status are request data, so they stream in behind a boundary. */}
        <Suspense fallback={<TopBarSkeleton />}>
          <TopBarWithData />
        </Suspense>
        <main id="main" className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </div>

      <DashboardNav variant="bottom" />
    </div>
  );
}

async function TopBarWithData() {
  const { user, store } = await requireCreator(DASHBOARD_PATH);
  const profile = await getProfile(user.id).catch(() => null);
  return <TopBar displayName={profile?.fullName || store.name} email={user.email} isPublished={store.isPublished} />;
}

function TopBarSkeleton() {
  return (
    <div className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4 md:px-6">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="ml-auto size-9 rounded-full" />
    </div>
  );
}
