import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProductsEmpty } from "@/components/dashboard/products-empty";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";

// Products (D-029). The list, editor and publish rules arrive with R3.
export default function ProductsPage() {
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
        <ProductsContent />
      </Suspense>
    </>
  );
}

async function ProductsContent() {
  await requireCreator("/dashboard/products");
  return (
    <Card>
      <ProductsEmpty />
    </Card>
  );
}
