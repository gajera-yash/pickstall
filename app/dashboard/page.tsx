import { BarChart3, Link2, Pencil } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { ChecklistCard } from "@/components/dashboard/checklist-card";
import { KpiSection, type KpiSeries } from "@/components/dashboard/kpi-section";
import { MyStoreTabs } from "@/components/dashboard/my-store-tabs";
import { DesignDraftProvider } from "@/components/dashboard/design-draft";
import { PageDesignForm } from "@/components/dashboard/page-design-form";
import { ProductsEmpty } from "@/components/dashboard/products-empty";
import { SocialLogo } from "@/components/brand/social-logos";
import { StoreLinkCard } from "@/components/dashboard/store-link-card";
import { HelpCard, StorePreviewCard } from "@/components/dashboard/store-preview-card";
import { SetupOnboarding } from "@/components/dashboard/setup-onboarding";
import { WelcomeHero } from "@/components/dashboard/welcome-hero";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { findPageBlocks } from "@/lib/page-blocks/queries";
import { salesByProduct } from "@/lib/products/stats";
import { requireCreator } from "@/lib/auth/guards";
import { DASHBOARD_PATH } from "@/lib/auth/post-login";
import { getProfile } from "@/lib/auth/profiles";
import { incomeStats } from "@/lib/orders/creator-queries";
import { PageSectionsEditor } from "@/components/dashboard/page-sections-editor";
import { DesignCustomizer } from "@/components/dashboard/design-customizer";
import { safeDesign } from "@/lib/store-design/rules";
import { ProductList } from "@/components/dashboard/product-list";
import { SOCIAL_LINK_LABELS, storeLink } from "@/lib/config";
import { loadSetupGate } from "@/lib/dashboard/setup-gate";
import { firstName } from "@/lib/dashboard/greeting";
import { lessonCountsOf, type PublicProduct, type PublicStore } from "@/lib/stores/public";
import type { SocialLink } from "@/lib/stores/schemas";
import { displayValueFor } from "@/lib/stores/social-handles";

// My Store home (D-029, D-076, reference docs/ui-reference/dashboard.webp): welcome card, last-30-days
// KPIs and the Products / Store design / Links / Analytics tabs, with a live store preview and help on
// the right from 1280px up. Until setup is done it shows the onboarding screen instead (D-079). A store
// that is unlocked but has an open step again (unpublished, say) gets the "Get started" steps back.
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
  // The open tab comes from ?tab= in MyStoreTabs; awaiting searchParams keeps the page dynamic per URL.
  const [{ user, store }] = await Promise.all([requireCreator(DASHBOARD_PATH), searchParams]);
  const profile = await getProfile(user.id).catch(() => null);

  const { checklist, products, unlocked } = await loadSetupGate(store);
  // Until setup is done, My Store is the onboarding screen and the other sections are locked (D-079).
  if (!unlocked) return <SetupOnboarding checklist={checklist} />;
  const name = firstName(profile?.fullName) ?? store.name;
  const link = storeLink(store.slug);

  const [stats, pageBlocks, sales] = await Promise.all([incomeStats(store.id, store.currency, 90).catch(() => null), findPageBlocks(store.id).catch(() => []), salesByProduct(store.id).catch(() => new Map())]);
  const productCount = products.length;
  // Real numbers from paid orders; days without sales (or an unreachable database) are zeros.
  const series: KpiSeries = stats ? stats.series : { revenueCents: zeros(), orders: zeros(), customers: zeros() };
  // The live preview draws the real public page from the same public fields (D-062).
  const previewStore: PublicStore = {
    id: store.id,
    slug: store.slug,
    name: store.name,
    bio: store.bio,
    avatarUrl: store.avatarUrl,
    socialLinks: store.socialLinks,
    theme: store.theme,
    currency: store.currency,
    // The preview shows the page itself; a paused store gets the banner in the dashboard instead.
    isOpen: true,
    // The dashboard preview never loads pixels.
    pixels: null,
    pageBlocks,
  };
  const published = products.filter((product) => product.status === "published");
  const lessonCounts = await lessonCountsOf(store.id, published).catch(() => new Map<string, number>());
  const previewProducts: PublicProduct[] = published.map((product) => ({
      id: product._id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      descriptionDoc: product.descriptionDoc ?? null,
      coverUrl: product.coverUrl,
      priceCents: product.priceCents,
      salePriceCents: product.salePriceCents ?? null,
      buttonText: product.buttonText,
      type: product.type,
      course: product.type === "course" ? { category: product.course?.category ?? null, accessDays: product.course?.accessDays ?? null, lessonCount: lessonCounts.get(product._id) ?? 0 } : null,
      coaching: product.type === "coaching" ? { durationMinutes: product.coaching?.durationMinutes ?? 30 } : null,
    }));

  return (
    <DesignDraftProvider saved={{ themePreset: store.theme.preset, accent: store.theme.accent, custom: safeDesign(store.theme.custom) }}>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <WelcomeHero name={name} storeUrl={`https://${link}`} ready={checklist.complete} publicPath={store.isPublished ? `/@${store.slug}` : null} />

        {!checklist.complete && (
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <StoreLinkCard link={link} isPublished={store.isPublished} />
            <ChecklistCard {...checklist} />
          </div>
        )}

        <KpiSection currency={store.currency} series={series} />

        <MyStoreTabs
          productCount={productCount}
          products={products.length === 0 ? <ProductsEmpty /> : <ProductList products={products} currency={store.currency} storeSlug={store.slug} sales={sales} />}
          design={
            <>
              <PageDesignForm initial={{ themePreset: store.theme.preset, accent: store.theme.accent }} />
              <DesignCustomizer initial={safeDesign(store.theme.custom)} />
              <PageSectionsEditor initial={pageBlocks} />
            </>
          }
          links={<LinksTab links={store.socialLinks} />}
          analytics={<AnalyticsTab isPublished={store.isPublished} />}
        />
      </div>

      <aside aria-label="Store preview and help" className="flex flex-col gap-6 xl:sticky xl:top-22 xl:self-start">
        <StorePreviewCard store={previewStore} products={previewProducts} isPublished={store.isPublished} />
        <HelpCard />
      </aside>
    </div>
    </DesignDraftProvider>
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
