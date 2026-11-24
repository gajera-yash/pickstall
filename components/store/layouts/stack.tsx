import Link from "next/link";
import { StoreBlocks } from "@/components/store/store-blocks";
import { splitBlocks } from "@/lib/page-blocks/rules";

import { PriceAndButton, ProductCover, ProductKind } from "@/components/store/layouts/parts";
import { StoreHeader } from "@/components/store/store-header";
import { StoreFrame, cardStyle } from "@/components/store/store-theme";
import type { StoreLayoutProps } from "@/components/store/layouts/types";

/**
 * Clean, Bold and Soft. On a phone: one column, the header on a soft accent band, then one card per
 * product (cover or auto cover, type, title, short description, price and button). On a wide page
 * (@3xl and up, D-066): the header becomes a left-aligned banner and the products a grid of 2 (or 3).
 */
export function StackLayout({ store, products, theme, preview }: StoreLayoutProps) {
  const { preset } = theme;
  const { before, after } = splitBlocks(store.pageBlocks);

  return (
    <StoreFrame theme={theme} preview={preview} wide slug={store.slug}>
      <div className="flex w-full max-w-xl flex-col items-center gap-6 @3xl:max-w-5xl @3xl:gap-10">
      {/* A soft band in the creator's accent behind the header: their colors, a premium first glance. */}
      <div
        className="relative isolate w-full overflow-hidden px-5 py-8 @3xl:px-10 @3xl:py-10"
        style={{ borderRadius: preset.radiusPx, background: `linear-gradient(135deg, color-mix(in srgb, ${theme.accent} 12%, ${preset.background}) 0%, color-mix(in srgb, ${theme.accent} 4%, ${preset.background}) 100%)` }}
      >
        <span aria-hidden="true" className="absolute -top-24 -right-16 -z-10 size-72 rounded-full" style={{ background: `color-mix(in srgb, ${theme.accent} 10%, transparent)` }} />
        <StoreHeader store={store} align="banner" />
      </div>
      <StoreBlocks blocks={before} theme={theme} />
      {products.length === 0 ? (
        <p className="w-full p-6 text-center" style={{ ...cardStyle(theme), color: preset.muted }}>
          Products are coming soon. Check back later.
        </p>
      ) : (
        <section aria-labelledby="store-products" className="flex w-full flex-col gap-4">
          <h2 id="store-products" className="font-display text-h3 @3xl:text-h2" style={{ fontWeight: preset.displayWeight }}>
            {products.length === 1 ? "Featured" : "Shop"}
            <span className="ml-2 text-sm font-normal" style={{ color: preset.muted }}>
              {products.length} {products.length === 1 ? "product" : "products"}
            </span>
          </h2>
          {/* "List" from Store design (D-123): one column; otherwise the grid. */}
          <ul className={theme.productView === "list" ? "mx-auto flex w-full max-w-2xl flex-col gap-4" : "flex w-full flex-col gap-4 @3xl:grid @3xl:grid-cols-2 @3xl:gap-6 @5xl:grid-cols-3"}>
            {products.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/@${store.slug}/${product.slug}`}
                  className="group flex h-full flex-col overflow-hidden transition-transform duration-(--dur-fast) hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
                  style={cardStyle(theme)}
                >
                  <ProductCover product={product} theme={theme} className="aspect-video" />
                  <span className="flex flex-1 flex-col gap-2 p-4">
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
        </section>
      )}
      <StoreBlocks blocks={after} theme={theme} />
      </div>
    </StoreFrame>
  );
}
