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
 * total. Shows a full price breakdown: subtotal, discounts, platform fee (free), tax note and total.
 * Information only: the server recomputes the amount from the product when the order starts.
 */
export function OrderSummary({ product, storeName, currency, theme, bump = null }: { product: SummaryProduct; storeName: string; currency: string; theme: StoreTheme; bump?: { title: string; priceCents: number } | null }) {
  const { preset } = theme;
  const payable = payableCents(product);
  const discount = discountCentsOf(product);
  const isFree = payable === 0;

  return (
    <section aria-labelledby="order-summary" className="flex flex-col gap-4">
      <h2 id="order-summary" className="font-display text-h3" style={{ fontWeight: preset.displayWeight }}>
        Order summary
      </h2>

      {/* Product row */}
      <div className="flex items-center gap-3">
        <ProductThumb product={product} theme={theme} />
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold break-words">{product.title}</span>
          <span className="text-sm break-words" style={{ color: preset.muted }}>
            by {storeName}
          </span>
          {/* Regular price struck through when on sale */}
          {discount > 0 && (
            <span className="text-xs line-through tabular-nums" style={{ color: preset.muted }}>
              {formatMoney(product.priceCents, currency)}
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t" style={{ borderColor: borderColor(preset) }} />

      {/* Price breakdown */}
      <dl className="flex flex-col gap-2.5 text-sm tabular-nums">
        {isFree ? (
          /* Free product: just show total */
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-semibold">Total</dt>
            <dd className="font-display text-money-m">Free</dd>
          </div>
        ) : (
          <SummaryTotal
            baseTotalCents={payable}
            subtotalCents={product.priceCents}
            currency={currency}
            bump={bump}
            mutedColor={preset.muted}
            lineColor={borderColor(preset)}
          />
        )}
      </dl>
    </section>
  );
}
