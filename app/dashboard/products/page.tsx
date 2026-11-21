import { Plus, Upload } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProductList } from "@/components/dashboard/product-list";
import { salesByProduct } from "@/lib/products/stats";
import { ProductsEmpty } from "@/components/dashboard/products-empty";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { productCreateError } from "@/lib/products/create-errors";
import { listProducts } from "@/lib/products/queries";

// Products (D-030): every product of the store with its price and status.
export default function ProductsPage({ searchParams }: PageProps<"/dashboard/products">) {
  return (
    <>
      <PageHeader
        title="Products"
        description="Everything you sell: downloads, links and services."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/dashboard/products/import">
                <Upload aria-hidden="true" className="size-5" />
                Import
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/products/new">
                <Plus aria-hidden="true" className="size-5" />
                Add product
              </Link>
            </Button>
          </div>
        }
      />
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
        <ProductsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ProductsContent({ searchParams }: Pick<PageProps<"/dashboard/products">, "searchParams">) {
  const [{ store }, params] = await Promise.all([requireUnlockedCreator("/dashboard/products"), searchParams]);
  const [products, sales] = await Promise.all([listProducts(store.id), salesByProduct(store.id).catch(() => new Map())]);
  const error = productCreateError(params.error);
  const published = params.published === "1";

  return (
    <>
      {published && !error && (
        <Alert variant="success">
          <AlertDescription>Published. Buyers see it on your store page once your store is live.</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card className="overflow-hidden p-0">{products.length === 0 ? <div className="p-2 sm:p-3"><ProductsEmpty /></div> : <ProductList products={products} currency={store.currency} storeSlug={store.slug} sales={sales} />}</Card>
    </>
  );
}
