import { Package } from "lucide-react";
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
import { adminListProducts } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/products/money";

// Admin: products of every store (D-104), for reports of copyright or abuse.
export default function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <>
      <AdminPageTitle title="Products" description="The latest 50 products of all stores. Search by title." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <ProductsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ProductsContent({ searchParams }: Pick<PageProps<"/admin/products">, "searchParams">) {
  const [, raw] = await Promise.all([requireAdmin(), searchParams]);
  const q = queryText(raw.q);
  const rows = await adminListProducts({ q });
  return (
    <div className="flex flex-col gap-4">
      <AdminSearch action="/admin/products" q={q} placeholder="Product title..." label="Search products" />
      {rows.length === 0 ? (
        <EmptyState icon={Package} title="No products found">
          Try another title.
        </EmptyState>
      ) : (
        <ListCard>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Product</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>Price</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-64">
                    {row.status === "published" ? (
                      <Link href={`/@${row.storeSlug}/${row.slug}`} target="_blank" rel="noopener" className="block truncate font-semibold underline-offset-4 hover:underline">
                        {row.title}
                      </Link>
                    ) : (
                      <span className="block truncate font-semibold">{row.title}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/creators/${row.storeId}`} className="text-blue underline underline-offset-4">
                      @{row.storeSlug}
                    </Link>
                  </TableCell>
                  <TableCell className="text-mute">{row.type}</TableCell>
                  <TableCell>{row.status === "published" ? <Badge variant="live">Published</Badge> : <Badge variant="draft">{row.status}</Badge>}</TableCell>
                  <TableCell numeric>{row.priceCents === 0 ? "Free" : formatMoney(row.priceCents, row.currency)}</TableCell>
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
