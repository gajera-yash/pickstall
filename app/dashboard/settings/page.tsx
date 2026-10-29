import { Suspense } from "react";

import { StoreSetupForm } from "@/components/dashboard/store-setup-form";
import { UsernameCard } from "@/components/dashboard/username-card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";

// Settings > Store (PRD F8, D-028): store link with Change, then the profile editor with a live preview.
export default function StoreSettingsPage() {
  return (
    <Suspense fallback={<StoreSettingsSkeleton />}>
      <StoreSettingsContent />
    </Suspense>
  );
}

async function StoreSettingsContent() {
  const { store } = await requireCreator("/dashboard/settings");
  return (
    <>
      {/* Its own form, outside the profile form (forms must not nest, even through a portal). */}
      <UsernameCard username={store.slug} />
      <StoreSetupForm
        slug={store.slug}
        theme={store.theme}
        initial={{
          name: store.name,
          bio: store.bio ?? "",
          avatarUrl: store.avatarUrl ?? "",
          currency: store.currency,
          socialLinks: store.socialLinks,
        }}
      />
    </>
  );
}

function StoreSettingsSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading your store</span>
      <Skeleton className="h-36 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}
