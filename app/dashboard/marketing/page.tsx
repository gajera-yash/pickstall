import { Mail, Megaphone, ShoppingCart, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { CouponManager, type ManagedCoupon } from "@/components/dashboard/coupon-manager";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { couponRows, listCoupons } from "@/lib/coupons/queries";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { listProducts } from "@/lib/products/queries";

const TOOLS: { title: string; description: string; icon: LucideIcon; live: boolean; href?: string; badge?: string }[] = [
  {
    title: "Order bumps",
    description: "Offer one more product at checkout with a single tick. Set it on each product: in the Checkout form step of a digital product, or the Publish step of a course or coaching call.",
    icon: ShoppingCart,
    live: true,
  },
  {
    title: "Email list",
    description: "People who joined from a Collect emails product or ticked “Email me updates” at checkout. Search, export or remove them.",
    icon: Mail,
    live: true,
    href: "/dashboard/marketing/subscribers",
    badge: "Open list",
  },
  {
    title: "Broadcasts",
    description: "Email everyone on your list at once: news, a new product or an offer. Send yourself a test first.",
    icon: Megaphone,
    live: true,
    href: "/dashboard/marketing/broadcasts",
    badge: "Write one",
  },
];

// Marketing (D-029). Coupons (D-088) are managed here; order bumps (D-089) are set on each product;
// the email list (D-094) has its own page.
export default function MarketingPage() {
  return (
    <>
      <PageHeader title="Marketing" description="Tools to sell more to the audience you already have." />
      <Suspense fallback={<Skeleton className="h-48 w-full rounded-lg" />}>
        <MarketingContent />
      </Suspense>
    </>
  );
}

async function MarketingContent() {
  const { store } = await requireUnlockedCreator("/dashboard/marketing");
  const [coupons, products] = await Promise.all([listCoupons(store.id), listProducts(store.id)]);
  const managed: ManagedCoupon[] = couponRows(coupons, products, store.currency);

  return (
    <div className="flex flex-col gap-6">
      <CouponManager coupons={managed} products={products.map((product) => ({ id: product._id, title: product.title }))} currency={store.currency} />
      <MoreTools />
    </div>
  );
}

function MoreTools() {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {TOOLS.map(({ title, description, icon: Icon, live, href, badge }) => (
        <li key={title} className="relative">
          <Card className="h-full gap-3">
            <div className="flex items-center justify-between gap-2">
              <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-blue-soft text-blue">
                <Icon className="size-5" />
              </span>
              {live ? <Badge variant="live">{badge ?? "On each product"}</Badge> : <Badge variant="soon">Coming soon</Badge>}
            </div>
            <h2 className="font-display text-h3">
              {href ? (
                <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-blue">
                  {title}
                </Link>
              ) : (
                title
              )}
            </h2>
            <p className="text-sm text-mute">{description}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
