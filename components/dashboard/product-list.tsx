import { CalendarCheck, Download, ImageIcon, Mail, PlayCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { formatDay } from "@/components/dashboard/orders-ui";
import { ProductRowActions } from "@/components/dashboard/product-row-actions";
import { PriceTag } from "@/components/store/price-tag";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { safeImageSrc } from "@/lib/media/media";
import { formatMoney } from "@/lib/products/money";
import type { CreatorProduct } from "@/lib/products/queries";
import type { ProductSales } from "@/lib/products/stats";

const STATUS: Record<CreatorProduct["status"], { label: string; variant: "live" | "draft" }> = {
  published: { label: "Published", variant: "live" },
  draft: { label: "Draft", variant: "draft" },
  archived: { label: "Archived", variant: "draft" },
};

const TYPES: Record<CreatorProduct["type"], { label: string; icon: LucideIcon }> = {
  digital: { label: "Digital product", icon: Download },
  course: { label: "Course", icon: PlayCircle },
  coaching: { label: "Coaching call", icon: CalendarCheck },
  lead_magnet: { label: "Collect emails", icon: Mail },
};

function Cover({ product, className }: { product: CreatorProduct; className: string }) {
  const src = safeImageSrc(product.coverUrl);
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-blue-soft text-blue ${className}`}>
      {src ? (
        // A creator's own https image on any host, so next/image (fixed remote hosts) cannot load it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
      ) : (
        <ImageIcon className="size-5" />
      )}
    </span>
  );
}

function TypeLabel({ type }: { type: CreatorProduct["type"] }) {
  const { label, icon: Icon } = TYPES[type];
  return (
    <span className="inline-flex items-center gap-1 text-sm text-mute">
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  );
}

/**
 * The products table (D-102), newest first: product (cover, title, type), status, price, sales,
 * revenue and when it was added. The whole row opens the editor; "..." holds Edit, View on store,
 * Publish or Unpublish and Delete (D-059). Phones get one card per product.
 */
export function ProductList({ products, currency, storeSlug, sales = new Map() }: { products: CreatorProduct[]; currency: string; storeSlug: string; sales?: Map<string, ProductSales> }) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead numeric>Price</TableHead>
              <TableHead numeric>Sales</TableHead>
              <TableHead numeric>Revenue</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const status = STATUS[product.status];
              const stat = sales.get(product._id);
              return (
                <TableRow key={product._id} className="relative">
                  <TableCell className="max-w-80">
                    <span className="flex items-center gap-3">
                      <Cover product={product} className="size-11" />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        {/* The link covers the whole row, so any click on it opens the editor. */}
                        <Link
                          href={`/dashboard/products/${product._id}`}
                          className="truncate font-semibold text-ink after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-blue"
                        >
                          {product.title}
                        </Link>
                        <TypeLabel type={product.type} />
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell numeric className="whitespace-nowrap">
                    <PriceTag product={product} currency={currency} regularClassName="text-mute" />
                  </TableCell>
                  <TableCell numeric className="tabular-nums">
                    {(stat?.orders ?? 0).toLocaleString("en")}
                  </TableCell>
                  <TableCell numeric className="font-semibold whitespace-nowrap tabular-nums">
                    {stat?.revenueCents ? formatMoney(stat.revenueCents, currency) : <span className="font-normal text-mute">-</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-mute">{formatDay(product.createdAt)}</TableCell>
                  <TableCell className="relative z-10 text-right">
                    <ProductRowActions product={{ id: product._id, title: product.title, status: product.status, publicPath: `/@${storeSlug}/${product.slug}` }} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {products.map((product) => {
          const status = STATUS[product.status];
          const stat = sales.get(product._id);
          return (
            <li key={product._id} className="flex items-center gap-1 pr-1">
              <Link href={`/dashboard/products/${product._id}`} className="flex min-h-[76px] min-w-0 flex-1 items-center gap-3 px-2 py-3 hover:bg-bg-subtle focus-visible:bg-bg-subtle focus-visible:outline-none">
                <Cover product={product} className="size-12" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-semibold">{product.title}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <TypeLabel type={product.type} />
                    <span className="text-sm">
                      <PriceTag product={product} currency={currency} regularClassName="text-mute" />
                    </span>
                  </span>
                  <span className="text-xs text-mute">
                    {(stat?.orders ?? 0).toLocaleString("en")} {stat?.orders === 1 ? "sale" : "sales"}
                    {stat?.revenueCents ? ` · ${formatMoney(stat.revenueCents, currency)}` : ""}
                  </span>
                </span>
                <Badge variant={status.variant}>{status.label}</Badge>
              </Link>
              <ProductRowActions product={{ id: product._id, title: product.title, status: product.status, publicPath: `/@${storeSlug}/${product.slug}` }} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
