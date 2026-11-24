import { Suspense } from "react";

import { StoreDesigner } from "@/components/dashboard/store-designer";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { storePreviewData } from "@/lib/dashboard/store-preview";
import { findPageBlocks } from "@/lib/page-blocks/queries";
import { listProducts } from "@/lib/products/queries";
import { safeDesign } from "@/lib/store-design/rules";

// Store design (D-125): theme, custom design and page sections on their own page, with a large
// live preview and one Save button. Only the session's own store is read and saved.
export default function StoreDesignPage() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[640px] w-full rounded-xl" />
          <Skeleton className="hidden h-[640px] w-full rounded-xl lg:block" />
        </div>
      }
    >
      <StoreDesignContent />
    </Suspense>
  );
}

async function StoreDesignContent() {
  const { store } = await requireUnlockedCreator("/dashboard/design");
  const [products, pageBlocks] = await Promise.all([listProducts(store.id).catch(() => []), findPageBlocks(store.id).catch(() => [])]);
  const { previewStore, previewProducts } = await storePreviewData(store, products, pageBlocks);
  return <StoreDesigner store={previewStore} products={previewProducts} isPublished={store.isPublished} custom={safeDesign(store.theme.custom)} blocks={pageBlocks} />;
}
