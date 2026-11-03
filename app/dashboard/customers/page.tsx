import { Download, ReceiptText, Search, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { CopyButton, DetailsSheet } from "@/components/dashboard/details-sheet";
import { Answers, DetailList, DetailSection, Initial, ListCard, ListToolbar, OrderBadges, formatDay, orderNumber } from "@/components/dashboard/orders-ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCreator } from "@/lib/auth/guards";
import { findCustomerDetail, listCustomers, type CustomerRow } from "@/lib/orders/creator-queries";
import { encodeCustomerCursor, parseCustomerParams, withQuery, type CustomerParams } from "@/lib/orders/params";
import { formatMoney } from "@/lib/products/money";
import { listProducts } from "@/lib/products/queries";

// Customers (PRD F12): people with at least one paid order, as a table (cards on phones) with
// search, a product filter, "Load more" and CSV export. A row opens the customer in a drawer with
// their orders and checkout answers, through `?customer=<order id>` so no email goes into a URL.
// Built from paid orders of the signed-in creator's store only.
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

const PATH = "/dashboard/customers";

const listHref = (params: CustomerParams, extra: { after?: string; customer?: string } = {}) =>
  withQuery(PATH, { q: params.q, product: params.product, after: extra.after ?? (params.after ? encodeCustomerCursor(params.after) : undefined), customer: extra.customer });

async function CustomersContent({ searchParams }: Pick<PageProps<"/dashboard/customers">, "searchParams">) {
  const [{ store }, raw] = await Promise.all([requireCreator(PATH), searchParams]);
  const params = parseCustomerParams(raw);
  const [page, products] = await Promise.all([listCustomers(store.id, { q: params.q, product: params.product, after: params.after }), listProducts(store.id)]);
  const filtered = Boolean(params.q || params.product);
  const closeHref = listHref(params);

  return (
    <div className="flex flex-col gap-4">
      <ListToolbar action={PATH} q={params.q} product={params.product} products={products.map((item) => ({ id: item._id, title: item.title }))} searchLabel="Search customers" />

      {page.customers.length === 0 ? (
        <EmptyState icon={filtered ? Search : Users} title={filtered ? "No matching customers" : "No customers yet"}>
          {filtered ? "Try a different name, email or product." : "Buyers and their answers to your checkout questions appear here after their first paid order, with a CSV export."}
        </EmptyState>
      ) : (
        <ListCard>
          <CustomersTable customers={page.customers} currency={store.currency} hrefFor={(key) => listHref(params, { customer: key })} />
        </ListCard>
      )}

      {page.next && (
        <Button asChild variant="secondary" className="self-center">
          <Link href={listHref(params, { after: encodeCustomerCursor(page.next) })}>Load more</Link>
        </Button>
      )}

      {params.customer && (
        <Suspense
          key={params.customer}
          fallback={
            <DetailsSheet closeHref={closeHref} title="Customer">
              <Skeleton className="h-48 w-full rounded-md" />
            </DetailsSheet>
          }
        >
          <CustomerDrawer storeId={store.id} orderId={params.customer} closeHref={closeHref} />
        </Suspense>
      )}
    </div>
  );
}

function productsText(products: string[]): string {
  const [first] = products;
  if (!first) return "";
  return products.length > 1 ? `${first} +${products.length - 1} more` : first;
}

function CustomersTable({ customers, currency, hrefFor }: { customers: CustomerRow[]; currency: string; hrefFor: (key: string) => string }) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Customer</TableHead>
              <TableHead>Products bought</TableHead>
              <TableHead numeric>Answers</TableHead>
              <TableHead>Last order</TableHead>
              <TableHead numeric>Total spent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.key} className="relative cursor-pointer">
                <TableCell className="max-w-72">
                  <span className="flex items-center gap-3">
                    <Initial name={customer.name} />
                    <span className="flex min-w-0 flex-col">
                      {/* The link covers the whole row, so any click on it opens the customer. */}
                      <Link
                        href={hrefFor(customer.key)}
                        scroll={false}
                        className="truncate font-semibold text-ink after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-blue"
                      >
                        {customer.name}
                      </Link>
                      <span className="truncate text-xs text-mute">{customer.email}</span>
                    </span>
                  </span>
                </TableCell>
                <TableCell className="max-w-60">
                  <span className="block truncate">{productsText(customer.products)}</span>
                  <span className="block text-xs text-mute">
                    {customer.orderCount} {customer.orderCount === 1 ? "order" : "orders"}
                  </span>
                </TableCell>
                <TableCell numeric className="text-mute">
                  {customer.answersCount}
                </TableCell>
                <TableCell className="whitespace-nowrap text-mute">{formatDay(customer.lastOrderAt)}</TableCell>
                <TableCell numeric className="font-semibold">
                  {formatMoney(customer.totalCents, currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {customers.map((customer) => (
          <li key={customer.key}>
            <Link href={hrefFor(customer.key)} scroll={false} className="flex items-center gap-3 px-4 py-3 hover:bg-bg-subtle focus-visible:bg-bg-subtle focus-visible:outline-none">
              <Initial name={customer.name} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-semibold">{customer.name}</span>
                <span className="truncate text-sm text-mute">{customer.email}</span>
                <span className="truncate text-xs text-mute">
                  {customer.orderCount} {customer.orderCount === 1 ? "order" : "orders"} · Last {formatDay(customer.lastOrderAt)}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{formatMoney(customer.totalCents, currency)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

async function CustomerDrawer({ storeId, orderId, closeHref }: { storeId: string; orderId: string; closeHref: string }) {
  const customer = await findCustomerDetail(storeId, orderId);
  if (!customer) {
    return (
      <DetailsSheet closeHref={closeHref} title="Customer not found">
        <p className="text-sm text-mute">This customer has no paid orders in your store.</p>
      </DetailsSheet>
    );
  }

  const currency = customer.orders[0]?.currency ?? "usd";
  return (
    <DetailsSheet closeHref={closeHref} title={customer.name} description={customer.email}>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total spent", value: formatMoney(customer.totalCents, currency) },
          { label: "Orders", value: String(customer.orderCount) },
          { label: "Customer since", value: formatDay(customer.firstOrderAt) },
        ].map((stat) => (
          <div key={stat.label} className="flex min-w-0 flex-col gap-1 rounded-md border border-line p-3">
            <span className="text-xs text-mute">{stat.label}</span>
            <span className="truncate font-semibold tabular-nums">{stat.value}</span>
          </div>
        ))}
      </div>

      <DetailSection title="Contact">
        <DetailList
          rows={[
            {
              label: "Email",
              value: (
                <span className="flex items-center justify-end gap-1">
                  <span className="min-w-0 break-all">{customer.email}</span>
                  <CopyButton value={customer.email} label="Copy email" />
                </span>
              ),
            },
            ...(customer.phone ? [{ label: "Phone", value: customer.phone }] : []),
          ]}
        />
      </DetailSection>

      <DetailSection title={`Orders (${customer.orderCount})`}>
        <ul className="flex flex-col gap-3">
          {customer.orders.map((order) => (
            <li key={order.id} className="flex flex-col gap-3 rounded-md border border-line p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold break-words">{order.title}</span>
                  <span className="text-xs text-mute">
                    {orderNumber(order.id)} · {formatDay(order.paidAt)}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatMoney(order.totalCents, order.currency)}</span>
              </div>
              {order.provider === "mock" && <OrderBadges status="paid" provider={order.provider} />}
              <div className="rounded-md bg-bg-subtle p-3">
                <Answers answers={order.answers} />
              </div>
              <Link href={withQuery("/dashboard/orders", { order: order.id })} className="flex items-center gap-1.5 self-start text-sm font-semibold text-blue hover:underline">
                <ReceiptText aria-hidden="true" className="size-4" />
                Open order
              </Link>
            </li>
          ))}
        </ul>
      </DetailSection>
    </DetailsSheet>
  );
}
