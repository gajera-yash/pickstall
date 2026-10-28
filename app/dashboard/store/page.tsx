import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { StoreSetupForm } from "@/components/dashboard/store-setup-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";

// Store setup (PHASE1_PLAN.md B4): name, photo, bio, currency, theme, accent, link.
export default function StoreSetupPage() {
  return (
    <>
      <Link href="/dashboard" className="flex items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" />
        My Store
      </Link>
      <h1 className="font-display text-h1">Store setup</h1>
      <Suspense fallback={<StoreSetupSkeleton />}>
        <StoreSetupContent />
      </Suspense>
    </>
  );
}

async function StoreSetupContent() {
  const { store } = await requireCreator("/dashboard/store");
  return (
    <StoreSetupForm
      initial={{
        name: store.name,
        bio: store.bio ?? "",
        avatarUrl: store.avatarUrl ?? "",
        link: store.link ?? "",
        currency: store.currency,
        themePreset: store.theme.preset,
        accent: store.theme.accent,
      }}
    />
  );
}

function StoreSetupSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex max-w-xl flex-col gap-5">
      <span className="sr-only">Loading your store</span>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}
