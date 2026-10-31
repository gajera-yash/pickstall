import { ChevronDown, Download, Search, Users } from "lucide-react";
import { Suspense } from "react";

import { Answers, ListCard, formatDay } from "@/components/dashboard/orders-ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";
import { listCustomers } from "@/lib/orders/creator-queries";
import { formatMoney } from "@/lib/products/money";

// Customers (PRD F12): people with at least one paid order, with their totals and the answers they
// gave at checkout. Built from paid orders of the signed-in creator's store only.
export default function CustomersPage({ searchParams }: PageProps<"/dashboard/customers">) {
  return (
    <>
      <PageHeader
        title="Customers"
        description="Everyone who bought from you, with their answers to your checkout questions."
        action={
          <Button asChild variant="secondary">
            <a href="/dashboard/customers/export" download>
              <Download aria-hidden="true" className="size-4" />
              Export CSV
            </a>
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
        <CustomersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CustomersContent({ searchParams }: Pick<PageProps<"/dashboard/customers">, "searchParams">) {
  const [{ store }, raw] = await Promise.all([requireCreator("/dashboard/customers"), searchParams]);
  const q = typeof raw.q === "string" && raw.q.trim().length > 0 && raw.q.length <= 80 ? raw.q.trim() : undefined;
  const customers = await listCustomers(store.id, { q });

  return (
    <div className="flex flex-col gap-4">
      <form action="/dashboard/customers" className="relative flex sm:w-80">
        <label className="relative flex w-full">
          <span className="sr-only">Search customers</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mute" />
          <input type="search" name="q" defaultValue={q ?? ""} maxLength={80} placeholder="Search name or email..." className="h-10 w-full rounded-md border border-line bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-mute" />
        </label>
      </form>

      {customers.length === 0 ? (
        <EmptyState icon={q ? Search : Users} title={q ? "No matching customers" : "No customers yet"}>
          {q ? "Try a different name or email." : "Buyers and their answers to your checkout questions appear here after their first paid order, with a CSV export."}
        </EmptyState>
      ) : (
        <ListCard>
          <ul className="divide-y divide-line">
            {customers.map((customer) => (
              <li key={customer.email}>
                <details className="group">
                  <summary className="flex min-h-[72px] cursor-pointer list-none items-center gap-3 px-2 py-3 hover:bg-bg-subtle sm:gap-4 sm:px-3 [&::-webkit-details-marker]:hidden">
                    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-soft font-display font-bold text-ink">
                      {customer.name.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-semibold">{customer.name}</span>
                      <span className="truncate text-sm text-mute">
                        {customer.email}
                        {customer.phone ? ` · ${customer.phone}` : ""}
                      </span>
                    </span>
                    <span className="hidden text-right text-sm text-mute sm:block">
                      {customer.orderCount} {customer.orderCount === 1 ? "order" : "orders"}
                      <br />
                      Last: {formatDay(customer.lastOrderAt)}
                    </span>
                    <span className="font-semibold tabular-nums">{formatMoney(customer.totalCents, store.currency)}</span>
                    <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-mute transition-transform duration-(--dur-fast) group-open:rotate-180" />
                  </summary>
                  <div className="flex flex-col gap-4 border-t border-line bg-bg-subtle px-4 py-4 sm:px-6">
                    {customer.orders.map((order) => (
                      <div key={order.id} className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4">
                        <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="font-semibold">{order.title}</span>
                          <span className="text-mute">
                            {formatMoney(order.totalCents, store.currency)} · {formatDay(order.paidAt)}
                          </span>
                        </p>
                        <Answers answers={order.answers} />
                      </div>
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </ListCard>
      )}
    </div>
  );
}
