import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";

import { StoreHeader, priceLabel } from "@/components/store/store-page";
import { StoreFrame, cardStyle, resolveTheme } from "@/components/store/store-theme";
import { formatMoney } from "@/lib/products/money";
import type { PublicProduct, PublicStore } from "@/lib/stores/public";

/**
 * Public product page (PRD F4): cover, title, description, price (or the pay-what-you-want minimum)
 * and the Buy button. Checkout is built in R5, so the button is disabled and says why; nothing
 * private (delivery link, questions, email text) is on this page.
 */
export function ProductPage({ store, product }: { store: PublicStore; product: PublicProduct }) {
  const theme = resolveTheme(store.theme);
  const { preset } = theme;
  const minimum = product.pricingModel === "pwyw" ? (product.minPriceCents ?? 0) : 0;

  return (
    <StoreFrame theme={theme}>
      <Link href={`/@${store.slug}`} className="inline-flex items-center gap-1 self-start text-sm font-semibold" style={{ color: preset.muted }}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        {store.name}
      </Link>
      <article className="flex w-full flex-col gap-5 overflow-hidden p-5" style={cardStyle(theme)}>
        {product.coverUrl && (
          // A creator's own https link on any host, so next/image (fixed remote hosts) cannot load it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.coverUrl} alt="" referrerPolicy="no-referrer" className="aspect-video w-full rounded-md object-cover" />
        )}
        <h1 className="font-display text-h1 break-words" style={{ fontWeight: preset.displayWeight }}>
          {product.title}
        </h1>
        {product.description && (
          <p className="text-body-l break-words whitespace-pre-line" style={{ color: preset.muted }}>
            {product.description}
          </p>
        )}
        <div className="flex flex-col gap-1">
          <p className="font-display text-money-l tabular-nums">{priceLabel(product, store.currency)}</p>
          {product.pricingModel === "pwyw" && (
            <p className="text-sm" style={{ color: preset.muted }}>
              Suggested {formatMoney(product.priceCents, store.currency)}
              {minimum > 0 ? `, minimum ${formatMoney(minimum, store.currency)}` : ", any amount"}.
            </p>
          )}
        </div>
        <button
          type="button"
          disabled
          className="flex h-13 w-full cursor-not-allowed items-center justify-center gap-2 text-button opacity-60"
          style={{ background: theme.accent, color: theme.onAccent, borderRadius: Math.min(preset.radiusPx, 12) }}
        >
          <Lock aria-hidden="true" className="size-4" />
          {product.buttonText || "Buy now"}
        </button>
        <p className="text-center text-sm" style={{ color: preset.muted }}>
          Checkout opens soon. Payments are being connected for this store.
        </p>
      </article>
      <StoreHeader store={store} linkToStore />
    </StoreFrame>
  );
}
