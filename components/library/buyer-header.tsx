import { Suspense } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { BuyerMenu, BuyerTabs } from "@/components/library/buyer-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/guards";
import { getProfile } from "@/lib/auth/profiles";
import { findStoreByOwner } from "@/lib/stores/queries";

/**
 * The buyer area's top bar (library, purchases, course player, account): logo, the two places and
 * the account menu. Sticky and translucent so the page scrolls under it.
 */
export function BuyerHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
        <Wordmark className="h-8" priority />
        <div className="flex items-center gap-2 sm:gap-3">
          {/* The current place comes from the URL (request data), so it streams in behind a boundary. */}
          <Suspense fallback={<Skeleton className="h-10 w-24 rounded-full sm:w-56" />}>
            <BuyerTabs />
          </Suspense>
          <Suspense fallback={<Skeleton className="size-10 rounded-full" />}>
            <Menu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function Menu() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [profile, store] = await Promise.all([getProfile(user.id).catch(() => null), findStoreByOwner(user.id).catch(() => null)]);
  return <BuyerMenu email={user.email} name={profile?.fullName ?? null} isCreator={store !== null} />;
}
