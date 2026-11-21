import { ImageIcon } from "lucide-react";

import { SummaryTotal } from "@/components/store/checkout-totals";
import { borderColor, type StoreTheme } from "@/components/store/store-theme";
import { formatMoney } from "@/lib/products/money";
import { discountCentsOf, payableCents, type Priced } from "@/lib/products/pricing";
import { safeImageSrc } from "@/lib/media/media";

type SummaryProduct = Priced & { title: string; coverUrl: string | null };

/** A product's small cover (or an accent placeholder) for the checkout and thank-you pages. */
export function ProductThumb({ product, theme, className = "size-16" }: { product: SummaryProduct; theme: StoreTheme; className?: string }) {
  const src = safeImageSrc(product.coverUrl);
  if (src) {
    // A creator's own https link on any host, so next/image (fixed remote hosts) cannot load it.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" referrerPolicy="no-referrer" className={`${className} shrink-0 rounded-md object-cover`} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`${className} flex shrink-0 items-center justify-center rounded-md font-display text-h3`}
      style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${theme.accent} 30%, ${theme.preset.card}), color-mix(in srgb, ${theme.accent} 10%, ${theme.preset.card}))`, color: theme.preset.text }}
    >
      {product.title.trim().charAt(0).toUpperCase() || <ImageIcon className="size-6" />}
    </span>
  );
}

/**
 * Order summary on the checkout page (D-069): the product, its regular price, the discount and the
 * total. Information only: the server recomputes the amount from the product when the order starts.
 */
export function OrderSummary({ product, storeName, currency, theme, bump = null }: { product: SummaryProduct; storeName: string; currency: string; theme: StoreTheme; bump?: { title: string; priceCents: number } | null }) {
  const { preset } = theme;
  const total = payableCents(product);
  const discount = discountCentsOf(product);

  return (
    <section aria-labelledby="order-summary" className="flex flex-col gap-4">
      <h2 id="order-summary" className="font-display text-h3" style={{ fontWeight: preset.displayWeight }}>
        Order summary
      </h2>
      <div className="flex items-center gap-3">
        <ProductThumb product={product} theme={theme} />
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold break-words">{product.title}</span>
          <span className="text-sm break-words" style={{ color: preset.muted }}>
            by {storeName}
          </span>
        </div>
      </div>
      <dl className="flex flex-col gap-2 border-t pt-4 text-sm tabular-nums" style={{ borderColor: borderColor(preset) }}>
        {discount > 0 && (
          <>
            <div className="flex justify-between gap-3">
              <dt style={{ color: preset.muted }}>Price</dt>
              <dd>{formatMoney(product.priceCents, currency)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt style={{ color: preset.muted }}>Discount</dt>
              <dd>−{formatMoney(discount, currency)}</dd>
            </div>
          </>
        )}
        {/* The coupon and bump lines and the total follow the checkout form (D-090). */}
        <SummaryTotal baseTotalCents={total} currency={currency} bump={bump} mutedColor={preset.muted} lineColor={borderColor(preset)} />
      </dl>
    </section>
  );
}
