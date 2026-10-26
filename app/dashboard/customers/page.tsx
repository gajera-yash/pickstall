import { Users } from "lucide-react";
import { Suspense } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";

// Customers (D-011, D-013). Buyers and their checkout answers arrive with checkout (Block D).
export default function CustomersPage() {
  return (
    <>
      <h1 className="font-display text-h1">Customers</h1>
      <Suspense fallback={<Skeleton className="h-56 w-full rounded-lg" />}>
        <CustomersContent />
      </Suspense>
    </>
  );
}

async function CustomersContent() {
  await requireCreator("/dashboard/customers");
  return (
    <EmptyState icon={Users} title="No customers yet">
      Buyers and their answers to your checkout questions appear here, with a CSV export.
    </EmptyState>
  );
}
