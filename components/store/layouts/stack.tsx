import Link from "next/link";
import { StoreBlocks } from "@/components/store/store-blocks";
import { splitBlocks } from "@/lib/page-blocks/rules";

import { PriceTag } from "@/components/store/price-tag";
import { RatingBadge } from "@/components/store/stars";
import { StoreHeader } from "@/components/store/store-header";
import { StoreFrame, borderColor, cardStyle } from "@/components/store/store-theme";
import type { StoreLayoutProps } from "@/components/store/layouts/types";
import { safeImageSrc } from "@/lib/media/media";

/**
 * Clean, Bold and Soft. On a phone: the original single column, header then one card per product.
 * On a wide page (@3xl and up, D-066): the header becomes a left-aligned banner with a rule under
 * it, and the products form a grid of 2 (or 3 on very wide pages) cards with their buttons lined up.
 */
export function StackLayout({ store, products, theme, preview }: StoreLayoutProps) {
  const { preset } = theme;
  const { before, after } = splitBlocks(store.pageBlocks);

  return (
    <StoreFrame theme={theme} preview={preview} wide>
      <div className="flex w-full max-w-xl flex-col items-center gap-6 @3xl:max-w-5xl @3xl:gap-10">
      <div className="w-full @3xl:border-b @3xl:pb-10" style={{ borderColor: borderColor(preset) }}>
        <StoreHeader store={store} align="banner" />
      </div>
      <StoreBlocks blocks={before} theme={theme} />
      {products.length === 0 ? (
        <p className="w-full p-6 text-center" style={{ ...cardStyle(theme), color: preset.muted }}>
          Products are coming soon. Check back later.
        </p>
      ) : (
        <ul className="flex w-full flex-col gap-4 @3xl:grid @3xl:grid-cols-2 @3xl:gap-6 @5xl:grid-cols-3">
          {products.map((product) => (
            <li key={product.id}>
              <Link href={`/@${store.slug}/${product.slug}`} className="flex h-full flex-col gap-3 overflow-hidden p-4" style={cardStyle(theme)}>
                {safeImageSrc(product.coverUrl) && (
                  // A creator's own https link on any host, so next/image (fixed remote hosts) cannot load it.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={safeImageSrc(product.coverUrl) ?? ""} alt="" referrerPolicy="no-referrer" loading="lazy" className="aspect-video w-full rounded-md object-cover" />
                )}
                <span className="font-display text-h3 break-words" style={{ fontWeight: preset.displayWeight }}>
                  {product.title}
                </span>
                {product.rating && product.rating.count > 0 && <RatingBadge average={product.rating.average} count={product.rating.count} color={theme.accent} mutedColor={preset.muted} />}
                {product.description && (
                  <span className="line-clamp-2 text-sm break-words" style={{ color: preset.muted }}>
                    {product.description}
                  </span>
                )}
                <span className="mt-auto flex items-center justify-between gap-3">
                  <PriceTag product={product} currency={store.currency} className="font-display text-money-m" regularStyle={{ color: preset.muted }} />
                  <span
                    className="flex h-11 items-center rounded-md px-5 text-button"
                    style={{ background: theme.accent, color: theme.onAccent, borderRadius: Math.min(preset.radiusPx, 12) }}
                  >
                    {product.buttonText || "Buy now"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <StoreBlocks blocks={after} theme={theme} />
      </div>
    </StoreFrame>
  );
}
