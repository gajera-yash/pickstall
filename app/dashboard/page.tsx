import { PackageOpen } from "lucide-react";
import { Suspense } from "react";

import { ChecklistCard } from "@/components/dashboard/checklist-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";
import { DASHBOARD_PATH } from "@/lib/auth/post-login";
import { storeLink } from "@/lib/config";
import { buildChecklist } from "@/lib/dashboard/checklist";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// My Store (D-011): first-run checklist, the store link, products.
export default function MyStorePage() {
  return (
    <>
      <h1 className="font-display text-h1">My Store</h1>
      <Suspense fallback={<MyStoreSkeleton />}>
        <MyStoreContent />
      </Suspense>
    </>
  );
}

async function MyStoreContent() {
  const { store } = await requireCreator(DASHBOARD_PATH);

  // RLS limits this count to the creator's own products.
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id);
  if (error) {
    logger.error("dashboard.product_count_failed", { code: error.code });
    throw new Error("Could not load your products.");
  }

  const checklist = buildChecklist({
    bio: store.bio,
    avatarUrl: store.avatar_url,
    chargesEnabled: store.stripe_charges_enabled,
    isPublished: store.is_published,
    productCount: count ?? 0,
  });

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-mute">Your link</p>
        <p className="flex flex-wrap items-center gap-2 font-semibold break-all">
          {storeLink(store.slug)}
          {!store.is_published && <Badge variant="draft">Not published yet</Badge>}
        </p>
      </div>

      {checklist.next && <ChecklistCard {...checklist} />}

      <section aria-labelledby="products-title" className="flex flex-col gap-4">
        <h2 id="products-title" className="font-display text-h2">
          Products
        </h2>
        {(count ?? 0) === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title="No products yet"
            action={<Badge variant="soon">Adding products is coming next</Badge>}
          >
            Add a digital download or a link to start selling.
          </EmptyState>
        ) : (
          <p className="text-mute">
            You have {count} {count === 1 ? "product" : "products"}. The product list is coming next.
          </p>
        )}
      </section>
    </>
  );
}

function MyStoreSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading your store</span>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
