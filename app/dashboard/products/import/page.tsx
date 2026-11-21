import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProductImport } from "@/components/dashboard/product-import";
import { Skeleton } from "@/components/ui/skeleton";
import { loadSetupGate, requireUnlockedCreator } from "@/lib/dashboard/setup-gate";

// Products > Import (PRD 9): from Gumroad or a CSV (Stan Store), as drafts.
export default function ProductImportPage() {
  return (
    <>
      <Link href="/dashboard/products" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Products
      </Link>
      <PageHeader title="Import products" description="Moving from Gumroad or Stan Store? Bring your products over in a minute." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <ImportContent />
      </Suspense>
    </>
  );
}

async function ImportContent() {
  const { store } = await requireUnlockedCreator("/dashboard/products/import");
  // While setup still locks the products list (D-079), "See my products" goes to the setup's product step.
  const { unlocked } = await loadSetupGate(store);
  return <ProductImport currency={store.currency} productsHref={unlocked ? "/dashboard/products" : "/dashboard/setup?step=first-product"} />;
}
