import { PackageOpen, ShoppingBag, Users, Wallet, type LucideIcon } from "lucide-react";
import { Suspense } from "react";

import { ChecklistCard } from "@/components/dashboard/checklist-card";
import { MyStoreTabs, type MyStoreTab } from "@/components/dashboard/my-store-tabs";
import { PageDesignForm } from "@/components/dashboard/page-design-form";
import { StoreLinkCard } from "@/components/dashboard/store-link-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";
import { DASHBOARD_PATH } from "@/lib/auth/post-login";
import { getProfile } from "@/lib/auth/profiles";
import { CURRENCY_LABELS, storeLink, type Currency } from "@/lib/config";
import { buildChecklist } from "@/lib/dashboard/checklist";
import { firstName } from "@/lib/dashboard/greeting";

// My Store home (D-028, DESIGN.md 10.2): greeting, store link, first-run checklist, example KPI
// cards, then the Products and Page design tabs. One page, no extra nav item.
export default function MyStorePage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<MyStoreSkeleton />}>
      <MyStoreContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MyStoreContent({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const [{ user, store }, params] = await Promise.all([requireCreator(DASHBOARD_PATH), searchParams]);
  const profile = await getProfile(user.id).catch(() => null);
  const initialTab: MyStoreTab = params.tab === "design" ? "design" : "products";

  // Products arrive in R3; until then a store has none.
  const productCount: number = 0;

  const checklist = buildChecklist({
    bio: store.bio,
    avatarUrl: store.avatarUrl,
    chargesEnabled: store.stripeChargesEnabled,
    isPublished: store.isPublished,
    productCount,
  });
  const name = firstName(profile?.fullName) ?? store.name;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h1 break-words">Welcome, {name}</h1>
        <p className="text-mute">
          {checklist.next ? "A few steps and your store is ready to sell." : "Your store is live. Here is how it is doing."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <StoreLinkCard link={storeLink(store.slug)} isPublished={store.isPublished} />
        {checklist.next && <ChecklistCard {...checklist} />}
      </div>

      <KpiCards currency={store.currency} />

      <MyStoreTabs
        initialTab={initialTab}
        products={
          productCount === 0 ? (
            <EmptyState icon={PackageOpen} title="No products yet" action={<Badge variant="soon">Adding products is coming next</Badge>}>
              Add a digital download or a link to start selling.
            </EmptyState>
          ) : (
            <p className="text-mute">
              You have {productCount} {productCount === 1 ? "product" : "products"}. The product list is coming next.
            </p>
          )
        }
        design={
          <PageDesignForm
            initial={{ themePreset: store.theme.preset, accent: store.theme.accent }}
            preview={{
              slug: store.slug,
              name: store.name,
              bio: store.bio ?? "",
              avatarUrl: store.avatarUrl ?? "",
              socialLinks: store.socialLinks,
            }}
          />
        }
      />
    </>
  );
}

/** Example KPI cards (DESIGN.md 10.2): labelled until real sales data exists (R6). */
function KpiCards({ currency }: { currency: Currency }) {
  const zero = new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(0);
  const cards: { label: string; value: string; icon: LucideIcon }[] = [
    { label: "Revenue", value: zero, icon: Wallet },
    { label: "Orders", value: "0", icon: ShoppingBag },
    { label: "Customers", value: "0", icon: Users },
  ];

  return (
    <section aria-labelledby="kpi-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="kpi-title" className="font-display text-h3">
          Last 30 days
        </h2>
        <Badge variant="example">Example layout</Badge>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <li key={label}>
            <Card className="gap-3 p-5 sm:p-5">
              <p className="flex items-center gap-2 text-sm font-medium text-mute">
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </p>
              <p className="font-display text-money-l text-ink tabular-nums">{value}</p>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-sm text-mute">
        Real numbers appear after your first sale, in {CURRENCY_LABELS[currency]}. Pickstall takes 0% of your sales; Stripe&apos;s card
        processing fees still apply.
      </p>
    </section>
  );
}

function MyStoreSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading your store</span>
      <Skeleton className="h-9 w-72" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-44 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
