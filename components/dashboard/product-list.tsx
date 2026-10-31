import { ChevronRight, Download, ImageIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { safeImageSrc } from "@/lib/media/media";
import { formatMoney } from "@/lib/products/money";
import type { CreatorProduct } from "@/lib/products/queries";

const STATUS: Record<CreatorProduct["status"], { label: string; variant: "live" | "draft" }> = {
  published: { label: "Published", variant: "live" },
  draft: { label: "Draft", variant: "draft" },
  archived: { label: "Archived", variant: "draft" },
};

function priceLabel(product: CreatorProduct, currency: string): string {
  if (product.pricingModel === "pwyw") return `From ${formatMoney(product.minPriceCents ?? 0, currency)}`;
  return product.priceCents === 0 ? "Free" : formatMoney(product.priceCents, currency);
}

/** Product rows: cover, title, type, price and status. Each row opens the editor. */
export function ProductList({ products, currency }: { products: CreatorProduct[]; currency: string }) {
  return (
    <ul className="divide-y divide-line">
      {products.map((product) => {
        const status = STATUS[product.status];
        return (
          <li key={product._id}>
            <Link href={`/dashboard/products/${product._id}`} className="flex min-h-[72px] items-center gap-4 px-2 py-3 transition-colors duration-(--dur-fast) hover:bg-bg-subtle sm:px-3">
              <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-blue-soft text-blue">
                {safeImageSrc(product.coverUrl) ? (
                  // A creator's own https image on any host, so next/image (fixed remote hosts) cannot load it.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={safeImageSrc(product.coverUrl) ?? ""} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
                ) : (
                  <ImageIcon className="size-5" />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-semibold">{product.title}</span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mute">
                  <span className="inline-flex items-center gap-1">
                    <Download aria-hidden="true" className="size-3.5" />
                    Digital product
                  </span>
                  <span className="tabular-nums">{priceLabel(product, currency)}</span>
                </span>
              </span>
              <Badge variant={status.variant}>{status.label}</Badge>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-mute" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
