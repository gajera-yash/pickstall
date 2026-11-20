import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AffiliateManager, type ManagedAffiliate } from "@/components/dashboard/affiliate-manager";
import { PageHeader } from "@/components/dashboard/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { affiliateTotals, listAffiliates } from "@/lib/affiliates/queries";
import { storeLink } from "@/lib/config";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { formatMoney } from "@/lib/products/money";

// Affiliates (D-113): the store's affiliates, their links, sales and commission, and payments the
// creator recorded. Tracking only: the platform never pays affiliates. Only the signed-in store.
const PATH = "/dashboard/marketing/affiliates";

export default function AffiliatesPage() {
  return (
    <>
      <Link href="/dashboard/marketing" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Marketing
      </Link>
      <PageHeader title="Affiliates" description="People who share your store for a commission. You pay them; Pickstall keeps count." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <AffiliatesContent />
      </Suspense>
    </>
  );
}

async function AffiliatesContent() {
  const { store } = await requireUnlockedCreator(PATH);
  const [affiliates, totals] = await Promise.all([listAffiliates(store.id), affiliateTotals(store.id, store.currency)]);
  const money = (cents: number) => formatMoney(cents, store.currency);
  const rows: ManagedAffiliate[] = affiliates.map((affiliate) => {
    const total = totals.get(affiliate._id) ?? { orders: 0, salesCents: 0, commissionCents: 0, paidCents: 0 };
    const owedCents = Math.max(0, total.commissionCents - total.paidCents);
    return {
      id: affiliate._id,
      name: affiliate.name,
      email: affiliate.email,
      code: affiliate.code,
      commissionPercent: affiliate.commissionPercent,
      active: affiliate.active,
      orders: total.orders,
      sales: money(total.salesCents),
      commission: money(total.commissionCents),
      paid: money(total.paidCents),
      owed: money(owedCents),
      owedCents,
    };
  });
  return <AffiliateManager affiliates={rows} currency={store.currency} storeUrl={`https://${storeLink(store.slug)}`} />;
}
