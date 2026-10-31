import { Search, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { ListCard, OrderListItem } from "@/components/dashboard/orders-ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";
import { countOrdersByStatus, listOrders } from "@/lib/orders/creator-queries";
import { ORDER_STATUSES, parseOrderParams } from "@/lib/orders/params";
import { cn } from "@/lib/utils";

// Orders (PRD F8): every order of the store with its status, newest first. Test orders from the
// development mock are labelled "Test". The store always comes from the session, never the URL.
export default function OrdersPage({ searchParams }: PageProps<"/dashboard/orders">) {
  return (
    <>
      <PageHeader title="Orders" description="Every purchase from your store, with its status and the buyer's answers." />
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
        <OrdersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const LABELS: Record<string, string> = { all: "All", paid: "Paid", pending: "Pending", refunded: "Refunded", failed: "Failed" };

function href(params: { status?: string; q?: string; before?: string }): string {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.q) query.set("q", params.q);
  if (params.before) query.set("before", params.before);
  const text = query.toString();
  return text ? `/dashboard/orders?${text}` : "/dashboard/orders";
}

async function OrdersContent({ searchParams }: Pick<PageProps<"/dashboard/orders">, "searchParams">) {
  const [{ store }, raw] = await Promise.all([requireCreator("/dashboard/orders"), searchParams]);
  const params = parseOrderParams(raw);
  const [page, counts] = await Promise.all([listOrders(store.id, params), countOrdersByStatus(store.id)]);
  const total = ORDER_STATUSES.reduce((sum, status) => sum + counts[status], 0);

  if (total === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="No orders yet"
        action={
          <Button asChild variant="secondary" className="mt-1">
            <Link href="/dashboard#get-started">Finish setting up your store</Link>
          </Button>
        }
      >
        Orders show up here the moment someone buys. Publish your store and share your link to get your first sale.
      </EmptyState>
    );
  }

  const tabs = [{ key: "all", count: total }, ...ORDER_STATUSES.map((key) => ({ key, count: counts[key] }))];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Order status" className="flex gap-1 overflow-x-auto">
          {tabs.map(({ key, count }) => {
            const active = (params.status ?? "all") === key;
            return (
              <Link
                key={key}
                href={href({ status: key === "all" ? undefined : key, q: params.q })}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold", active ? "bg-blue-soft text-ink" : "text-mute hover:bg-bg-subtle hover:text-ink")}
              >
                {LABELS[key]}
                <span className="text-xs tabular-nums text-mute">{count}</span>
              </Link>
            );
          })}
        </nav>
        <form action="/dashboard/orders" className="relative flex lg:w-72">
          {params.status && <input type="hidden" name="status" value={params.status} />}
          <label className="relative flex w-full">
            <span className="sr-only">Search orders</span>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mute" />
            <input type="search" name="q" defaultValue={params.q ?? ""} maxLength={80} placeholder="Search name or email..." className="h-10 w-full rounded-md border border-line bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-mute" />
          </label>
        </form>
      </div>

      {page.orders.length === 0 ? (
        <EmptyState icon={Search} title="No matching orders">
          Try another status or a different search.
        </EmptyState>
      ) : (
        <ListCard>
          <ul className="divide-y divide-line">
            {page.orders.map((order) => (
              <OrderListItem key={order.id} order={order} />
            ))}
          </ul>
        </ListCard>
      )}

      {page.nextBefore && (
        <Button asChild variant="secondary" className="self-center">
          <Link href={href({ status: params.status, q: params.q, before: page.nextBefore })}>Show older orders</Link>
        </Button>
      )}
    </div>
  );
}
