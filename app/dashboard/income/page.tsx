import { ShoppingBag, Trophy, Users, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { ListCard, OrderAccordion } from "@/components/dashboard/orders-ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { incomeStats, listOrders } from "@/lib/orders/creator-queries";
import { lastSum, sum } from "@/lib/orders/series";
import { formatMoney } from "@/lib/products/money";
import { cn } from "@/lib/utils";

const RANGES = [7, 30, 90] as const;

// Income (PRD F8): revenue today, over a range, orders, customers and top products. Real numbers
// from paid orders in the store's currency; Pickstall takes 0%, Stripe's card fees still apply.
export default function IncomePage({ searchParams }: PageProps<"/dashboard/income">) {
  return (
    <>
      <PageHeader title="Income" description="What you earned from your store. Pickstall takes 0% of your sales." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <IncomeContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: LucideIcon; tone: string }) {
  return (
    <Card className="flex-row items-center gap-4 p-5 sm:p-5">
      <span aria-hidden="true" className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", tone)}>
        <Icon className="size-6" />
      </span>
      <div className="flex min-w-0 flex-col">
        <p className="text-sm font-medium text-mute">{label}</p>
        <p className="truncate font-display text-money-l tabular-nums">{value}</p>
      </div>
    </Card>
  );
}

async function IncomeContent({ searchParams }: Pick<PageProps<"/dashboard/income">, "searchParams">) {
  const [{ store }, raw] = await Promise.all([requireUnlockedCreator("/dashboard/income"), searchParams]);
  const requested = Number(typeof raw.days === "string" ? raw.days : "30");
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 30;

  const [stats, recent] = await Promise.all([incomeStats(store.id, store.currency, 90), listOrders(store.id, { status: "paid", limit: 5 })]);

  if (stats.totalPaidOrders === 0) {
    return (
      <EmptyState icon={Wallet} title="No sales yet">
        When someone buys from your store, your income shows here. We don&apos;t take a cut of your sales. Stripe&apos;s card processing fees still apply.
      </EmptyState>
    );
  }

  const { series } = stats;
  const money = (cents: number) => formatMoney(cents, store.currency);
  const shownDays = series.days.slice(-days);
  const shownRevenue = series.revenueCents.slice(-days);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Today" value={money(lastSum(series.revenueCents, 1))} icon={Wallet} tone="bg-blue-soft text-blue" />
        <Stat label={`Last ${days} days`} value={money(lastSum(series.revenueCents, days))} icon={Wallet} tone="bg-blue-soft text-blue" />
        <Stat label="Orders" value={String(lastSum(series.orders, days))} icon={ShoppingBag} tone="bg-violet-soft text-violet" />
        <Stat label="Customers (90 days)" value={String(stats.customersInRange)} icon={Users} tone="bg-mint-soft text-mint" />
      </div>

      <Card className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-h3">Revenue</h2>
          <nav aria-label="Date range" className="flex gap-1">
            {RANGES.map((range) => (
              <Link key={range} href={`/dashboard/income?days=${range}`} aria-current={range === days ? "page" : undefined} className={cn("flex min-h-10 items-center rounded-md px-3 text-sm font-semibold", range === days ? "bg-blue-soft text-ink" : "text-mute hover:bg-bg-subtle hover:text-ink")}>
                {range} days
              </Link>
            ))}
          </nav>
        </div>
        <RevenueChart days={shownDays} revenueCents={shownRevenue} currency={store.currency} />
        <p className="text-sm text-mute">
          Total over {days} days: {money(sum(shownRevenue))}. {stats.refundedCents > 0 ? `Refunded: ${money(stats.refundedCents)}. ` : ""}Days are shown in UTC.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-3">
          <h2 className="flex items-center gap-2 font-display text-h3">
            <Trophy aria-hidden="true" className="size-5 text-mute" />
            Top products (90 days)
          </h2>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-mute">No paid sales in the last 90 days.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-line">
              {stats.topProducts.map((product) => (
                <li key={product.productId} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0 truncate font-medium">{product.title}</span>
                  <span className="shrink-0 text-sm text-mute">
                    {product.orders} {product.orders === 1 ? "sale" : "sales"} · <span className="font-semibold text-ink tabular-nums">{money(product.revenueCents)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="gap-3 p-0 sm:p-0">
          <div className="flex items-center justify-between gap-2 px-5 pt-5 sm:px-6 sm:pt-6">
            <h2 className="flex items-center gap-2 font-display text-h3">
              Recent orders
            </h2>
            <Link href="/dashboard/orders" className="text-sm font-semibold text-blue hover:text-blue-hover">
              View all
            </Link>
          </div>
          <ListCard>
            <OrderAccordion orders={recent.orders} />
          </ListCard>
        </Card>
      </div>
    </div>
  );
}
