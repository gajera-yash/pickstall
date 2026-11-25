import { Suspense } from "react";

import { CouponManager, type ManagedCoupon } from "@/components/dashboard/coupon-manager";
import { PageHeader } from "@/components/dashboard/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { couponRows, listCoupons } from "@/lib/coupons/queries";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { listProducts } from "@/lib/products/queries";

// Coupons (D-088) on their own page (D-129). Only the session's own store.
export default function CouponsPage() {
  return (
    <>
      <PageHeader title="Coupons" description="Discount codes buyers enter at checkout, like SAVE20. Share them in your posts and emails." />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
        <CouponsContent />
      </Suspense>
    </>
  );
}

async function CouponsContent() {
  const { store } = await requireUnlockedCreator("/dashboard/marketing/coupons");
  const [coupons, products] = await Promise.all([listCoupons(store.id), listProducts(store.id)]);
  const managed: ManagedCoupon[] = couponRows(coupons, products, store.currency);
  return <CouponManager coupons={managed} products={products.map((product) => ({ id: product._id, title: product.title }))} currency={store.currency} />;
}
