import Link from "next/link";

import { PriceAndButton, ProductCover, ProductKind } from "@/components/store/layouts/parts";
import type { StoreLayoutProps } from "@/components/store/layouts/types";
import { StoreHeader } from "@/components/store/store-header";
import { StoreFrame, cardStyle } from "@/components/store/store-theme";

/**
 * Frosted Glass (D-065): glassmorphism. A soft pastel gradient page with see-through, blurred cards:
 * the profile in a centered card, then the products in a grid. The text colors are tested on the
 * card mixed over every gradient color, so they stay readable wherever a card sits.
 */
export function GlassLayout({ store, products, theme, preview }: StoreLayoutProps) {
  const { preset } = theme;

  return (
    <StoreFrame theme={theme} preview={preview} wide>
      <div className="flex w-full max-w-5xl flex-col gap-8">
        <div className="mx-auto w-full max-w-2xl p-8" style={cardStyle(theme)}>
          <StoreHeader store={store} />
        </div>

        {products.length === 0 ? (
          <p className="mx-auto w-full max-w-2xl p-6 text-center" style={{ ...cardStyle(theme), color: preset.muted }}>
            Products are coming soon. Check back later.
          </p>
        ) : (
          <ul className="grid gap-5 @2xl:grid-cols-2 @5xl:grid-cols-3">
            {products.map((product) => (
              <li key={product.id}>
                <Link href={`/@${store.slug}/${product.slug}`} className="flex h-full flex-col gap-4 p-3" style={cardStyle(theme)}>
                  <ProductCover product={product} theme={theme} className="aspect-video overflow-hidden rounded-[14px]" />
                  <span className="flex flex-1 flex-col gap-2 px-2 pb-2">
                    <ProductKind product={product} theme={theme} />
                    <span className="font-display text-h3 break-words" style={{ fontWeight: preset.displayWeight }}>
                      {product.title}
                    </span>
                    {product.description && (
                      <span className="line-clamp-2 text-sm break-words" style={{ color: preset.muted }}>
                        {product.description}
                      </span>
                    )}
                    <span className="mt-auto pt-2">
                      <PriceAndButton product={product} theme={theme} currency={store.currency} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </StoreFrame>
  );
}
