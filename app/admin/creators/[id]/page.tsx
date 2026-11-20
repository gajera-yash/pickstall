import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdminPageTitle, PlanBadge, Stat, moneyList } from "@/components/admin/admin-ui";
import { formatDay, ListCard } from "@/components/dashboard/orders-ui";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { adminStoreDetail } from "@/lib/admin/queries";
import { isUuid } from "@/lib/media/media";
import { formatMoney } from "@/lib/products/money";

// Admin: one creator's store (D-103). Read-only in A1; actions come in A2.
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
  const store = await adminStoreDetail(id);
  if (!store) notFound();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <AdminPageTitle title={store.name} description={`@${store.slug} · ${store.ownerEmail || "no email"} · joined ${formatDay(store.createdAt)}`} />
        <PlanBadge access={store.access} />
        {store.isPublished ? <Badge variant="live">Live</Badge> : <Badge variant="draft">Draft</Badge>}
      </div>
      {store.isPublished && (
        <Link href={`/@${store.slug}`} target="_blank" rel="noopener" className="self-start text-sm font-semibold text-blue underline underline-offset-4">
          Open store page
        </Link>
      )}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {store.products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="max-w-72 truncate font-semibold">{product.title}</TableCell>
                  <TableCell className="text-mute">{product.type}</TableCell>
                  <TableCell>{product.status === "published" ? <Badge variant="live">Published</Badge> : <Badge variant="draft">{product.status}</Badge>}</TableCell>
                  <TableCell numeric>{product.priceCents === 0 ? "Free" : formatMoney(product.priceCents, store.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ListCard>
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
