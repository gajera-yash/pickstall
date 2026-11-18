import { Download, Search, ShoppingBag, UserRound } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { CopyButton, DetailsSheet } from "@/components/dashboard/details-sheet";
import { Answers, DetailList, DetailSection, ListCard, ListToolbar, OrderBadges, formatDateTime, formatDay, orderNumber } from "@/components/dashboard/orders-ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { CancelCallButton } from "@/components/dashboard/cancel-call-button";
import { RefundButton } from "@/components/dashboard/refund-button";
import { UpcomingCalls } from "@/components/dashboard/upcoming-calls";
import { ResendEmailButton } from "@/components/dashboard/resend-email-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { findOrderCall, listUpcomingCalls, type OrderCall } from "@/lib/coaching/calls";
import { formatCallTime } from "@/lib/coaching/ics";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { countOrdersByStatus, findOrderDetail, listOrders, type OrderDetail, type OrderRow } from "@/lib/orders/creator-queries";
import { ORDER_STATUSES, parseOrderParams, withQuery, type OrderParams } from "@/lib/orders/params";
import { formatMoney } from "@/lib/products/money";
import { listProducts } from "@/lib/products/queries";
import { cn } from "@/lib/utils";

// Orders (PRD F8): every order of the store with its status, newest first, as a table (cards on
// phones) with status tabs, search, a product filter and CSV export. A row opens the order in a
// drawer through `?order=`. Test orders from the development mock are labelled "Test". The store
// always comes from the session, never the URL.
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
const PATH = "/dashboard/orders";

const listHref = (params: OrderParams, extra: { before?: string; order?: string } = {}) =>
  withQuery(PATH, { status: params.status, q: params.q, product: params.product, before: extra.before ?? params.before?.toISOString(), order: extra.order });

async function OrdersContent({ searchParams }: Pick<PageProps<"/dashboard/orders">, "searchParams">) {
  const [{ store }, raw] = await Promise.all([requireUnlockedCreator(PATH), searchParams]);
  const params = parseOrderParams(raw);
  const [page, counts, products, calls] = await Promise.all([listOrders(store.id, params), countOrdersByStatus(store.id), listProducts(store.id), listUpcomingCalls(store.id).catch(() => [])]);
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
  const filtersOnly = { status: params.status, q: params.q, product: params.product };
  const closeHref = listHref(params);

  return (
    <div className="flex flex-col gap-4">
      <UpcomingCalls calls={calls} hrefFor={(id) => listHref(params, { order: id })} />

      <nav aria-label="Order status" className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(({ key, count }) => {
          const active = (params.status ?? "all") === key;
          return (
            <Link
              key={key}
              href={withQuery(PATH, { status: key === "all" ? undefined : key, q: params.q, product: params.product })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors duration-(--dur-fast)",
                active ? "border-blue text-ink" : "border-transparent text-mute hover:text-ink",
              )}
            >
              {LABELS[key]}
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-blue-soft text-ink" : "bg-bg-subtle text-mute")}>{count}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <ListToolbar action={PATH} q={params.q} product={params.product} products={products.map((item) => ({ id: item._id, title: item.title }))} keep={{ status: params.status }} searchLabel="Search orders" />
        <Button asChild variant="secondary" className="self-start lg:self-auto">
          <a href={withQuery(`${PATH}/export`, filtersOnly)} download>
            <Download aria-hidden="true" className="size-4" />
            Export CSV
          </a>
        </Button>
      </div>

      {page.orders.length === 0 ? (
        <EmptyState icon={Search} title="No matching orders">
          Try another status, product or search.
        </EmptyState>
      ) : (
        <ListCard>
          <OrdersTable orders={page.orders} hrefFor={(id) => listHref(params, { order: id })} />
        </ListCard>
      )}

      {page.nextBefore && (
        <Button asChild variant="secondary" className="self-center">
          <Link href={listHref(params, { before: page.nextBefore })}>Load more</Link>
        </Button>
      )}

      {params.order && (
        <Suspense
          key={params.order}
          fallback={
            <DetailsSheet closeHref={closeHref} title="Order">
              <Skeleton className="h-48 w-full rounded-md" />
            </DetailsSheet>
          }
        >
          <OrderDrawer storeId={store.id} orderId={params.order} closeHref={closeHref} />
        </Suspense>
      )}
    </div>
  );
}

function OrdersTable({ orders, hrefFor }: { orders: OrderRow[]; hrefFor: (id: string) => string }) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Date</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead numeric>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id} className="relative cursor-pointer">
                <TableCell className="whitespace-nowrap text-mute">{formatDay(order.createdAt)}</TableCell>
                <TableCell>
                  {/* The link covers the whole row, so any click on it opens the order. */}
                  <Link
                    href={hrefFor(order.id)}
                    scroll={false}
                    aria-label={`Order ${orderNumber(order.id)} from ${order.buyerName}`}
                    className="font-mono text-xs font-semibold text-ink after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-blue"
                  >
                    {orderNumber(order.id)}
                  </Link>
                </TableCell>
                <TableCell className="max-w-56">
                  <span className="block truncate font-semibold">{order.buyerName}</span>
                  <span className="block truncate text-xs text-mute">{order.buyerEmail}</span>
                </TableCell>
                <TableCell className="max-w-56">
                  <span className="block truncate">{order.title}</span>
                </TableCell>
                <TableCell>
                  <OrderBadges status={order.status} provider={order.provider} />
                </TableCell>
                <TableCell numeric className="font-semibold">
                  {formatMoney(order.totalCents, order.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {orders.map((order) => (
          <li key={order.id}>
            <Link href={hrefFor(order.id)} scroll={false} className="flex flex-col gap-1.5 px-4 py-3 hover:bg-bg-subtle focus-visible:bg-bg-subtle focus-visible:outline-none">
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 truncate font-semibold">{order.title}</span>
                <span className="shrink-0 font-semibold tabular-nums">{formatMoney(order.totalCents, order.currency)}</span>
              </span>
              <span className="truncate text-sm text-mute">
                {order.buyerName} · {formatDay(order.createdAt)}
              </span>
              <OrderBadges status={order.status} provider={order.provider} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Where the buyer's access email stands, in plain words. */
const CALL_STATUS: Record<OrderCall["status"], string> = {
  held: "Waiting for payment",
  confirmed: "Booked",
  released: "Not booked (payment did not go through)",
  conflict: "Needs a new time: this time was taken before the payment arrived",
  cancelled: "Cancelled",
};

/** A coaching order's call (D-086): its time in the coach's zone, its state, and "Cancel call". */
function CallSection({ orderId, call, amount, paid, orderPaid }: { orderId: string; call: OrderCall; amount: string; paid: boolean; orderPaid: boolean }) {
  const cancellable = orderPaid && (call.status === "confirmed" || call.status === "conflict");
  return (
    <DetailSection title="Call">
      <DetailList
        rows={[
          { label: "When", value: formatCallTime(call.start, call.end, call.timeZone) },
          { label: "Status", value: CALL_STATUS[call.status] },
        ]}
      />
      {call.status === "conflict" && <p className="text-sm text-mute">Email the buyer to agree a new time, or cancel and refund the call.</p>}
      {cancellable && <CancelCallButton orderId={orderId} amount={amount} paid={paid} />}
    </DetailSection>
  );
}

function accessEmailLabel(email: OrderDetail["accessEmail"]): string {
  if (!email) return "Not sent";
  if (email.status === "sent") return email.sentAt ? `Sent ${formatDateTime(email.sentAt)}` : "Sent";
  if (email.status === "sending") return "Sending";
  return "Not delivered";
}

const PAID_WITH: Record<OrderRow["provider"], string> = { stripe: "Stripe", mock: "Test payment", free: "Free product" };

async function OrderDrawer({ storeId, orderId, closeHref }: { storeId: string; orderId: string; closeHref: string }) {
  const [order, call] = await Promise.all([findOrderDetail(storeId, orderId), findOrderCall(storeId, orderId).catch(() => null)]);
  if (!order) {
    return (
      <DetailsSheet closeHref={closeHref} title="Order not found">
        <p className="text-sm text-mute">This order doesn&apos;t exist or isn&apos;t from your store.</p>
      </DetailsSheet>
    );
  }

  const money = (cents: number) => formatMoney(cents, order.currency);
  return (
    <DetailsSheet closeHref={closeHref} title={`Order ${orderNumber(order.id)}`} description={formatDateTime(order.createdAt)}>
      <div className="flex flex-col gap-2">
        <p className="font-display text-h2 tabular-nums">{money(order.totalCents)}</p>
        <OrderBadges status={order.status} provider={order.provider} />
      </div>

      <DetailSection title="Product">
        <p className="font-semibold break-words">{order.title}</p>
      </DetailSection>

      {call && <CallSection orderId={order.id} call={call} amount={money(order.totalCents)} paid={order.refundable} orderPaid={order.status === "paid"} />}

      <DetailSection title="Payment">
        <DetailList
          rows={[
            { label: "Price", value: money(order.subtotalCents), numeric: true },
            ...(order.discountCents > 0 ? [{ label: "Discount", value: `−${money(order.discountCents)}`, numeric: true }] : []),
            ...(order.coupon ? [{ label: "Coupon", value: `${order.coupon.code} (−${money(order.coupon.discountCents)})` }] : []),
            { label: "Total", value: money(order.totalCents), numeric: true },
            { label: "Paid with", value: PAID_WITH[order.provider] },
            { label: "Paid on", value: order.paidAt ? formatDateTime(order.paidAt) : "Not paid" },
            ...(order.refundedAt ? [{ label: "Refunded on", value: formatDateTime(order.refundedAt) }] : []),
            ...(order.amountRefundedCents > 0 ? [{ label: "Refunded", value: money(order.amountRefundedCents), numeric: true }] : []),
          ]}
        />
        {order.refundable &&
          (order.refundRequestedAt ? (
            <p className="text-sm text-mute">Refund requested. It shows here as refunded once Stripe confirms it, usually within a minute.</p>
          ) : (
            <RefundButton orderId={order.id} amount={money(order.totalCents)} />
          ))}
      </DetailSection>

      <DetailSection title="Customer">
        <DetailList
          rows={[
            { label: "Name", value: order.buyerName },
            {
              label: "Email",
              value: (
                <span className="flex items-center justify-end gap-1">
                  <span className="min-w-0 break-all">{order.buyerEmail}</span>
                  <CopyButton value={order.buyerEmail} label="Copy email" />
                </span>
              ),
            },
            ...(order.buyerPhone ? [{ label: "Phone", value: order.buyerPhone }] : []),
          ]}
        />
        {order.status === "paid" && (
          <Button asChild variant="secondary" size="sm" className="self-start">
            <Link href={withQuery("/dashboard/customers", { customer: order.id })}>
              <UserRound aria-hidden="true" className="size-4" />
              View customer
            </Link>
          </Button>
        )}
      </DetailSection>

      {order.status === "paid" && (
        <DetailSection title="Delivery">
          <DetailList
            rows={[
              { label: "Access email", value: accessEmailLabel(order.accessEmail) },
              { label: "Downloads used", value: order.downloadLimit ? `${order.accessCount} of ${order.downloadLimit}` : `${order.accessCount} (no limit)`, numeric: true },
            ]}
          />
          {order.accessEmail?.status !== "sent" && order.accessEmail?.status !== "sending" && (
            <>
              <p className="text-sm text-mute">The buyer didn&apos;t get the email with their access link. Send it again once your email settings are fixed.</p>
              <ResendEmailButton orderId={order.id} />
            </>
          )}
          {order.accessEmail?.status === "sent" && <p className="text-sm text-mute">If the buyer can&apos;t find it, ask them to check their spam folder.</p>}
        </DetailSection>
      )}

      <DetailSection title="Checkout answers">
        <Answers answers={order.answers} />
      </DetailSection>
    </DetailsSheet>
  );
}
