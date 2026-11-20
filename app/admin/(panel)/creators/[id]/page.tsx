import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdminAction } from "@/components/admin/admin-action";
import { AdminPageTitle, PlanBadge, Stat, moneyList } from "@/components/admin/admin-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDay, ListCard } from "@/components/dashboard/orders-ui";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { adminStoreDetail } from "@/lib/admin/queries";
import { planPaymentsOfStore } from "@/lib/plans/payments";
import { isUuid } from "@/lib/media/media";
import { formatMoney } from "@/lib/products/money";

// Admin: one creator's store (D-104), with the admin actions (D-105).
export default function AdminCreatorPage({ params }: PageProps<"/admin/creators/[id]">) {
  return (
    <>
      <Link href="/admin/creators" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Creators
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <CreatorContent params={params} />
      </Suspense>
    </>
  );
}

async function CreatorContent({ params }: Pick<PageProps<"/admin/creators/[id]">, "params">) {
  const [, { id }] = await Promise.all([requireAdmin(), params]);
  if (!isUuid(id)) notFound();
  const [store, planPayments] = await Promise.all([adminStoreDetail(id), planPaymentsOfStore(id).catch(() => [])]);
  if (!store) notFound();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <AdminPageTitle title={store.name} description={`@${store.slug} · ${store.ownerEmail || "no email"} · joined ${formatDay(store.createdAt)}`} />
        <PlanBadge access={store.access} />
        {store.isPublished ? <Badge variant="live">Live</Badge> : <Badge variant="draft">Draft</Badge>}
      </div>
      <div className="flex flex-wrap gap-4">
        {store.isPublished && (
          <Link href={`/@${store.slug}`} target="_blank" rel="noopener" className="text-sm font-semibold text-blue underline underline-offset-4">
            Open store page
          </Link>
        )}
        <Link href={`/admin/audit?store=${store.id}`} className="text-sm font-semibold text-blue underline underline-offset-4">
          Audit log for this store
        </Link>
      </div>
      {store.suspendedAt && (
        <Alert variant="error">
          <AlertDescription>
            Suspended on {formatDay(store.suspendedAt)}
            {store.suspendReason ? `: ${store.suspendReason}` : "."} The store is hidden and cannot sell or publish.
          </AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="admin-actions" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <h2 id="admin-actions" className="font-display text-h4">
          Actions
        </h2>
        <p className="text-sm text-mute">Every action asks for a reason and is saved in the audit log. Nothing here moves money or deletes data.</p>
        <div className="flex flex-wrap gap-3">
          <AdminAction label="Extend trial" title="Extend the free trial?" description={`The trial of ${store.name} is pushed out from today or from its current end, whichever is later.`} base={{ action: "extend_trial", storeId: store.id }} amount={{ label: "Add", key: "days", options: [7, 14, 30, 60, 90], unit: "days" }} />
          <AdminAction label="Grant founding" title="Make this a founding creator?" description={`${store.name} gets Pro for free for the chosen time, starting today.`} base={{ action: "grant_founding", storeId: store.id }} amount={{ label: "For", key: "months", options: [6, 3, 12, 1], unit: "months" }} />
          {store.broadcastsBlocked ? (
            <AdminAction label="Allow broadcasts" title="Allow broadcasts again?" description={`${store.name} can send broadcasts and welcome emails again.`} base={{ action: "unblock_broadcasts", storeId: store.id }} />
          ) : (
            <AdminAction label="Block broadcasts" title="Turn broadcasts off?" description={`${store.name} cannot send broadcasts or welcome emails until you allow them again. Use this after spam complaints.`} base={{ action: "block_broadcasts", storeId: store.id }} destructive />
          )}
          {store.suspendedAt ? (
            <AdminAction label="Restore store" title="Restore this store?" description={`${store.name} becomes visible again and can sell, as its plan allows.`} base={{ action: "restore", storeId: store.id }} />
          ) : (
            <AdminAction label="Suspend store" title="Suspend this store?" description={`${store.name} is hidden from buyers, checkout stops and the creator cannot publish. Orders, buyers' libraries and data stay as they are.`} base={{ action: "suspend", storeId: store.id }} destructive />
          )}
        </div>
        {store.broadcastsBlocked && <p className="text-sm font-semibold text-danger">Broadcasts are turned off for this store.</p>}
      </section>

      <section aria-label="Numbers" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Paid orders" value={store.orders.paid.toLocaleString("en")} />
        <Stat label="Sales" value={moneyList(store.orders.sales)} />
        <Stat label="Subscribers" value={store.subscribers.subscribed.toLocaleString("en")} hint={`${store.subscribers.unsubscribed} unsubscribed · ${store.subscribers.bounced} bounced · ${store.subscribers.complained} complaints`} />
        <Stat label="Stripe" value={store.stripeConnected ? "Connected" : "Not connected"} hint={`${store.broadcasts} broadcasts`} />
      </section>

      <section aria-labelledby="admin-products" className="flex flex-col gap-3">
        <h2 id="admin-products" className="font-display text-h3">
          Products ({store.products.length})
        </h2>
        <ListCard>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>Price</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store.products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="max-w-72 truncate font-semibold">{product.title}</TableCell>
                  <TableCell className="text-mute">{product.type}</TableCell>
                  <TableCell>{product.status === "published" ? <Badge variant="live">Published</Badge> : <Badge variant="draft">{product.status}</Badge>}</TableCell>
                  <TableCell numeric>{product.priceCents === 0 ? "Free" : formatMoney(product.priceCents, store.currency)}</TableCell>
                  <TableCell className="text-right">
                    {product.status === "published" && (
                      <AdminAction label="Unpublish" title={`Unpublish “${product.title}”?`} description="It goes back to draft and leaves the store. Buyers who bought it keep access in their library." base={{ action: "unpublish_product", productId: product.id }} destructive />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ListCard>
      </section>

      <section aria-labelledby="admin-plan-payments" className="flex flex-col gap-3">
        <h2 id="admin-plan-payments" className="font-display text-h3">
          Plan payments
        </h2>
        {planPayments.length === 0 ? (
          <p className="text-sm text-mute">This creator hasn&apos;t paid for a plan yet.</p>
        ) : (
          <ListCard>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Paid</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead numeric>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planPayments.map((payment) => (
                  <TableRow key={payment._id}>
                    <TableCell className="whitespace-nowrap">{formatDay(payment.paidAt)}</TableCell>
                    <TableCell className="capitalize">{payment.plan ?? "-"}</TableCell>
                    <TableCell numeric>{formatMoney(payment.amountCents, payment.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ListCard>
        )}
      </section>

      <section aria-labelledby="admin-orders" className="flex flex-col gap-3">
        <h2 id="admin-orders" className="font-display text-h3">
          Latest orders
        </h2>
        <ListCard>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Product</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>Total</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store.orders.recent.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="max-w-60 truncate">{order.title}</TableCell>
                  <TableCell className="max-w-60 truncate text-mute">{order.buyerEmail}</TableCell>
                  <TableCell>{order.status}</TableCell>
                  <TableCell numeric>{formatMoney(order.totalCents, order.currency)}</TableCell>
                  <TableCell className="whitespace-nowrap text-mute">{formatDay(order.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ListCard>
      </section>
    </div>
  );
}
