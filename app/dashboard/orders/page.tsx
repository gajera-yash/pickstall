import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";

// Orders (D-029). Paid, pending and refunded orders arrive with checkout (R5, R6).
export default function OrdersPage() {
  return (
    <>
      <PageHeader title="Orders" description="Every purchase from your store, with its status and the buyer's answers." />
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
        <OrdersContent />
      </Suspense>
    </>
  );
}

async function OrdersContent() {
  await requireCreator("/dashboard/orders");
  return (
    <EmptyState
      icon={ShoppingBag}
      title="No orders yet"
      action={
        <Button asChild variant="secondary" className="mt-1">
          <Link href="/dashboard#get-started">Finish setting up your store</Link>
        </Button>
      }
    >
      Orders show up here the moment someone buys. Publish your store and share your link to get your first sale.
    </EmptyState>
  );
}
