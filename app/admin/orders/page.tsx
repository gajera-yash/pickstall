import { ReceiptText } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AdminSearch } from "@/components/admin/admin-search";
import { AdminPageTitle, queryText } from "@/components/admin/admin-ui";
import { formatDay, ListCard } from "@/components/dashboard/orders-ui";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { adminListOrders } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/products/money";

// Admin: orders of every store, for support (D-103). Refunds stay with the creator's Stripe.
export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <>
      <AdminPageTitle title="Orders" description="The latest 50 orders of all stores. Search by order id, the buyer's exact email, or product title." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <OrdersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const STATUS_VARIANT: Record<string, "live" | "draft" | "danger" | "testMode"> = { paid: "live", pending: "testMode", failed: "draft", refunded: "danger" };

async function OrdersContent({ searchParams }: Pick<PageProps<"/admin/orders">, "searchParams">) {
  const [, raw] = await Promise.all([requireAdmin(), searchParams]);
  const q = queryText(raw.q, 200);
  const rows = await adminListOrders({ q });
  return (
    <div className="flex flex-col gap-4">
      <AdminSearch action="/admin/orders" q={q} placeholder="Order id, buyer email or product..." label="Search orders" />
      {rows.length === 0 ? (
        <EmptyState icon={ReceiptText} title="No orders found">
          Check the order id or email.
        </EmptyState>
      ) : (
        <ListCard>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Product</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>Total</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-60">
                    <span className="block truncate font-semibold">{row.title}</span>
                    <span className="block truncate font-mono text-xs text-mute">{row.id}</span>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/creators/${row.storeId}`} className="text-blue underline underline-offset-4">
                      @{row.storeSlug}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-mute">{row.buyerEmail}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status] ?? "draft"}>{row.status}</Badge>
                  </TableCell>
                  <TableCell numeric>{row.totalCents === 0 ? "Free" : formatMoney(row.totalCents, row.currency)}</TableCell>
                  <TableCell className="whitespace-nowrap text-mute">{formatDay(row.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ListCard>
      )}
    </div>
  );
}
