import { Filter, HandCoins, Mail, Megaphone, ShoppingCart, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { CartReminderSettings } from "@/components/dashboard/cart-reminder-settings";
import { CouponManager, type ManagedCoupon } from "@/components/dashboard/coupon-manager";
import { BUMP_HOW_IT_WORKS, HowItWorks, UPSELL_HOW_IT_WORKS, type HowItWorksContent } from "@/components/dashboard/how-it-works";
import { PixelSettings } from "@/components/dashboard/pixel-settings";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cartStats, findCartSettings } from "@/lib/abandoned-cart/queries";
import { couponRows, listCoupons } from "@/lib/coupons/queries";
import { findPixelSettings } from "@/lib/pixels/queries";
import { can } from "@/lib/plans/access";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { listProducts } from "@/lib/products/queries";

const TOOLS: { title: string; description: string; icon: LucideIcon; live: boolean; href?: string; badge?: string; how?: HowItWorksContent }[] = [
  {
    title: "Order bumps",
    description: "Offer one more product at checkout with a single tick. Set it on each product: in the Checkout form step of a digital product, or the Publish step of a course or coaching call.",
    icon: ShoppingCart,
    live: true,
    how: BUMP_HOW_IT_WORKS,
  },
  {
    title: "Upsell after purchase",
    description: "Offer another product on the thank-you page, right after someone buys. Set it on each product, next to the order bump.",
    icon: Sparkles,
    live: true,
    how: UPSELL_HOW_IT_WORKS,
  },
  {
    title: "Funnels",
    description: "Sale, then upsell, then downsell: see how many buyers take each offer. Add a downsell under the upsell of a product.",
    icon: Filter,
    live: true,
    href: "/dashboard/marketing/funnels",
    badge: "View",
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
  {
    title: "Affiliates",
    description: "Give people their own link and a commission on the sales they bring. You pay them yourself; Pickstall keeps count.",
    icon: HandCoins,
    live: true,
    href: "/dashboard/marketing/affiliates",
    badge: "Open",
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
  const [coupons, products, cart, stats, pixels] = await Promise.all([listCoupons(store.id), listProducts(store.id), findCartSettings(store.id), cartStats(store.id), findPixelSettings(store.id)]);
  const managed: ManagedCoupon[] = couponRows(coupons, products, store.currency);

  return (
    <div className="flex flex-col gap-6">
      <CouponManager coupons={managed} products={products.map((product) => ({ id: product._id, title: product.title }))} currency={store.currency} />
      <CartReminderSettings storeName={store.name} initial={cart} stats={stats} locked={!can(store.access, "automations")} />
      <PixelSettings initial={pixels} />
      <MoreTools />
    </div>
  );
}

function MoreTools() {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {TOOLS.map(({ title, description, icon: Icon, live, href, badge, how }) => (
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
            {how && <HowItWorks content={how} />}
          </Card>
        </li>
      ))}
    </ul>
  );
}
