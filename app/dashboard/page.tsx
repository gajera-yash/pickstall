import { BarChart3, Link2, Pencil } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { ChecklistCard } from "@/components/dashboard/checklist-card";
import { KpiSection, type KpiSeries } from "@/components/dashboard/kpi-section";
import { MyStoreTabs } from "@/components/dashboard/my-store-tabs";
import { PageDesignForm } from "@/components/dashboard/page-design-form";
import { ProductsEmpty } from "@/components/dashboard/products-empty";
import { SocialLogo } from "@/components/brand/social-logos";
import { HelpCard, StorePreviewCard } from "@/components/dashboard/store-preview-card";
import { WelcomeHero } from "@/components/dashboard/welcome-hero";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";
import { DASHBOARD_PATH } from "@/lib/auth/post-login";
import { getProfile } from "@/lib/auth/profiles";
import { incomeStats } from "@/lib/orders/creator-queries";
import { ProductList } from "@/components/dashboard/product-list";
import { SOCIAL_LINK_LABELS, storeLink } from "@/lib/config";
import { loadSetupState } from "@/lib/dashboard/setup-state";
import { MY_STORE_TABS, type MyStoreTab } from "@/lib/dashboard/nav";
import { firstName } from "@/lib/dashboard/greeting";
import type { SocialLink } from "@/lib/stores/schemas";
import { displayValueFor } from "@/lib/stores/social-handles";

// My Store home (D-029, D-045, reference docs/ui-reference/dashboard.webp). Until setup is done:
// the welcome card and the setup checklist only. After: welcome card, last-30-days KPIs and the
// Products / Store design / Links / Analytics tabs, with a live store preview and help on the right
// from 1280px up. Publishing and the store link live in Settings > Store from then on.
export default function MyStorePage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<MyStoreSkeleton />}>
      <MyStoreContent searchParams={searchParams} />
    </Suspense>
  );
}

const DAYS = 90;
const zeros = () => Array.from({ length: DAYS }, () => 0);

async function MyStoreContent({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const [{ user, store }, params] = await Promise.all([requireCreator(DASHBOARD_PATH), searchParams]);
  const profile = await getProfile(user.id).catch(() => null);
  const tabParam = typeof params.tab === "string" ? params.tab : "";
  const initialTab: MyStoreTab = (MY_STORE_TABS as readonly string[]).includes(tabParam) ? (tabParam as MyStoreTab) : "products";

  const { checklist, products } = await loadSetupState(store);
  const name = firstName(profile?.fullName) ?? store.name;
  const link = storeLink(store.slug);

  if (!checklist.complete) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        <WelcomeHero name={name} storeUrl={`https://${link}`} ready={false} publicPath={store.isPublished ? `/@${store.slug}` : null} />
        <ChecklistCard {...checklist} />
      </div>
    );
  }

  const stats = await incomeStats(store.id, store.currency, 90).catch(() => null);
  const productCount = products.length;
  // Real numbers from paid orders; days without sales (or an unreachable database) are zeros.
  const series: KpiSeries = stats ? stats.series : { revenueCents: zeros(), orders: zeros(), customers: zeros() };
  const preview = {
    slug: store.slug,
    name: store.name,
    bio: store.bio ?? "",
    avatarUrl: store.avatarUrl ?? "",
    socialLinks: store.socialLinks,
  };
  const previewProducts = products
    .filter((product) => product.status === "published")
    .map(({ _id, title, coverUrl, buttonText, priceCents, salePriceCents }) => ({ id: _id, title, coverUrl, buttonText, priceCents, salePriceCents: salePriceCents ?? null }));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <WelcomeHero name={name} storeUrl={`https://${link}`} ready publicPath={store.isPublished ? `/@${store.slug}` : null} />

        <KpiSection currency={store.currency} series={series} />

        <MyStoreTabs
          initialTab={initialTab}
          productCount={productCount}
          products={products.length === 0 ? <ProductsEmpty /> : <ProductList products={products} currency={store.currency} storeSlug={store.slug} />}
          design={
            <PageDesignForm
              initial={{ themePreset: store.theme.preset, accent: store.theme.accent }}
              preview={preview}
              products={previewProducts}
              currency={store.currency}
            />
          }
          links={<LinksTab links={store.socialLinks} />}
          analytics={<AnalyticsTab isPublished={store.isPublished} />}
        />
      </div>

      <aside aria-label="Store preview and help" className="flex flex-col gap-6 xl:sticky xl:top-22 xl:self-start">
        <StorePreviewCard
          data={{ ...preview, themePreset: store.theme.preset, accent: store.theme.accent }}
          products={previewProducts}
          currency={store.currency}
          isPublished={store.isPublished}
        />
        <HelpCard />
      </aside>
    </div>
  );
}

function LinksTab({ links }: { links: SocialLink[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-h4">Social links</h3>
          <p className="text-sm text-mute">Shown as icons under your name on your store page.</p>
        </div>
        <Button asChild variant="secondary" size="sm" className="h-10">
          <Link href="/dashboard/settings">
            <Pencil aria-hidden="true" className="size-4" />
            Edit links
          </Link>
        </Button>
      </div>
      {links.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line px-4 py-8 text-center">
          <Link2 aria-hidden="true" className="size-6 text-mute" />
          <p className="font-semibold">No links yet</p>
          <p className="text-sm text-mute">Add your Instagram, TikTok, YouTube or other usernames so buyers can find you.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {links.map((item, index) => {
            return (
              <li key={`${item.kind}-${index}`} className="flex items-center gap-3 px-4 py-3">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bg-subtle">
                  <SocialLogo kind={item.kind} colored className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold">{SOCIAL_LINK_LABELS[item.kind]}</span>
                  <span className="truncate text-sm text-mute">{displayValueFor(item.kind, item.url)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AnalyticsTab({ isPublished }: { isPublished: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-violet-soft text-violet">
        <BarChart3 className="size-7" />
      </span>
      <h3 className="font-display text-h3">No visits yet</h3>
      <p className="max-w-sm text-mute">
        {isPublished
          ? "Store views, clicks and sales show up here as soon as people visit your link."
          : "Publish your store and share your link. Views, clicks and sales show up here."}
      </p>
    </div>
  );
}

function MyStoreSkeleton() {
  return (
    <div role="status" aria-live="polite" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <span className="sr-only">Loading your store</span>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-48 w-full rounded-lg" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-lg" />
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
      <Skeleton className="hidden h-[640px] w-full rounded-lg xl:block" />
    </div>
  );
}
