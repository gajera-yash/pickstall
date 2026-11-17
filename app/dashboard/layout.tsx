import type { Metadata } from "next";
import { Suspense } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { SetupBar } from "@/components/dashboard/setup/setup-bar";
import { SidebarFooter } from "@/components/dashboard/sidebar-footer";
import { TopBar } from "@/components/dashboard/top-bar";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";
import { DASHBOARD_PATH } from "@/lib/auth/post-login";
import { getProfile } from "@/lib/auth/profiles";
import { loadSetupState } from "@/lib/dashboard/setup-state";
import { APP_NAME, storeLink } from "@/lib/config";

export const metadata: Metadata = { title: `Dashboard | ${APP_NAME}`, robots: { index: false } };

// App shell (D-029, reference docs/ui-reference/dashboard.webp): 256px white sidebar with the logo,
// eight sections, the Pro card and the creator; a 64px top bar with search; content uses the full
// width on the --bg-subtle page (founder request, 2026-11-03). Mobile: bottom bar with "More" (D-023, D-028).
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex min-h-dvh flex-1 bg-bg-subtle">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-3 py-5 md:flex">
        <Wordmark className="h-10 self-start px-3" priority />
        {/* usePathname() is request data, so the nav streams in behind a boundary. */}
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
          <DashboardNav variant="sidebar" />
        </Suspense>
        <Suspense fallback={<Skeleton className="mt-auto h-48 w-full rounded-lg" />}>
          <SidebarFooterWithData />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-0">
        {/* The account and store are request data, so they stream in behind a boundary. */}
        <Suspense fallback={<TopBarSkeleton />}>
          <TopBarWithData />
        </Suspense>
        <main id="main" className="flex w-full flex-1 flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
          <Suspense fallback={null}>
            <TrialBannerWithData />
          </Suspense>
          <Suspense fallback={null}>
            <SetupBarWithData />
          </Suspense>
          {children}
        </main>
      </div>

      <Suspense fallback={null}>
        <DashboardNav variant="bottom" />
      </Suspense>
    </div>
  );
}

async function displayNameFor() {
  const { user, store } = await requireCreator(DASHBOARD_PATH);
  const profile = await getProfile(user.id).catch(() => null);
  return { user, store, displayName: profile?.fullName || store.name };
}

async function TopBarWithData() {
  const { user, store, displayName } = await displayNameFor();
  return <TopBar displayName={displayName} email={user.email} storeUrl={`https://${storeLink(store.slug)}`} publicPath={store.isPublished ? `/@${store.slug}` : null} />;
}

async function TrialBannerWithData() {
  const { store } = await requireCreator(DASHBOARD_PATH);
  return <TrialBanner access={store.access} />;
}

async function SetupBarWithData() {
  const { store } = await requireCreator(DASHBOARD_PATH);
  const { checklist } = await loadSetupState(store);
  if (!checklist.next) return null;
  return <SetupBar doneCount={checklist.doneCount} requiredCount={checklist.requiredCount} nextLabel={checklist.next.label} />;
}

async function SidebarFooterWithData() {
  const { store, displayName } = await displayNameFor();
  return <SidebarFooter displayName={displayName} access={store.access} />;
}

function TopBarSkeleton() {
  return (
    <div className="flex h-16 items-center gap-3 border-b border-line bg-surface px-4 md:px-6">
      <Skeleton className="h-11 w-full max-w-lg" />
      <Skeleton className="ml-auto size-10 rounded-full" />
    </div>
  );
}
