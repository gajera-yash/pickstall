import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProductList } from "@/components/dashboard/product-list";
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
          <Button asChild>
            <Link href="/dashboard/products/new">
              <Plus aria-hidden="true" className="size-5" />
              Add product
            </Link>
          </Button>
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
  const products = await listProducts(store.id);
  const error = productCreateError(params.error);

  return (
    <>
      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card className="p-2 sm:p-3">{products.length === 0 ? <ProductsEmpty /> : <ProductList products={products} currency={store.currency} storeSlug={store.slug} />}</Card>
    </>
  );
}
