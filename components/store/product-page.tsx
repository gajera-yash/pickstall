import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";

import { PriceTag } from "@/components/store/price-tag";
import { RichTextView } from "@/components/store/rich-text";
import { StoreHeader } from "@/components/store/store-page";
import { StoreFrame, cardStyle, resolveTheme } from "@/components/store/store-theme";
import { safeImageSrc } from "@/lib/media/media";
import type { PublicProduct, PublicStore } from "@/lib/stores/public";

/**
 * Public product page (PRD F4): cover, title, description, price (with the regular price struck
 * through when discounted, D-047) and the Buy button. Checkout is built in R5, so the button is disabled and says why; nothing
 * private (delivery link, questions, email text) is on this page.
 */
export function ProductPage({ store, product, buyable }: { store: PublicStore; product: PublicProduct; buyable: boolean }) {
  const theme = resolveTheme(store.theme);
  const { preset } = theme;

  return (
    <StoreFrame theme={theme}>
      <Link href={`/@${store.slug}`} className="inline-flex items-center gap-1 self-start text-sm font-semibold" style={{ color: preset.muted }}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        {store.name}
      </Link>
      <article className="flex w-full flex-col gap-5 overflow-hidden p-5" style={cardStyle(theme)}>
        {safeImageSrc(product.coverUrl) && (
          // A creator's own https link on any host, so next/image (fixed remote hosts) cannot load it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safeImageSrc(product.coverUrl) ?? ""} alt="" referrerPolicy="no-referrer" className="aspect-video w-full rounded-md object-cover" />
        )}
        <h1 className="font-display text-h1 break-words" style={{ fontWeight: preset.displayWeight }}>
          {product.title}
        </h1>
        {product.descriptionDoc ? (
          <RichTextView doc={product.descriptionDoc} className="text-body-l" linkStyle={{ color: preset.text }} />
        ) : (
          // Products saved before D-049 have a plain description only.
          product.description && (
            <p className="text-body-l break-words whitespace-pre-line" style={{ color: preset.muted }}>
              {product.description}
            </p>
          )
        )}
        <p className="font-display text-money-l">
          <PriceTag product={product} currency={store.currency} regularStyle={{ color: preset.muted }} />
        </p>
        {buyable ? (
          <Link
            href={`/@${store.slug}/${product.slug}/checkout`}
            className="flex h-13 w-full items-center justify-center gap-2 text-button"
            style={{ background: theme.accent, color: theme.onAccent, borderRadius: Math.min(preset.radiusPx, 12) }}
          >
            {product.buttonText || "Buy now"}
          </Link>
        ) : (
          <>
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
              Payments aren&apos;t set up for this store yet. Please check back soon.
            </p>
          </>
        )}
      </article>
      <StoreHeader store={store} linkToStore />
    </StoreFrame>
  );
}
