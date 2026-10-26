import { Wallet } from "lucide-react";
import { Suspense } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";

// Income (D-011). Sales data arrives with checkout (Block D); until then this is an honest empty state.
export default function IncomePage() {
  return (
    <>
      <h1 className="font-display text-h1">Income</h1>
      <Suspense fallback={<Skeleton className="h-56 w-full rounded-lg" />}>
        <IncomeContent />
      </Suspense>
    </>
  );
}

async function IncomeContent() {
  await requireCreator("/dashboard/income");
  return (
    <EmptyState icon={Wallet} title="No sales yet">
      When someone buys from your store, your income shows here. We don&apos;t take a cut of your sales. Stripe&apos;s
      card processing fees still apply.
    </EmptyState>
  );
}
