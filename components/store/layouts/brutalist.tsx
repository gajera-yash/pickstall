import Link from "next/link";
import { StoreBlocks } from "@/components/store/store-blocks";
import { splitBlocks } from "@/lib/page-blocks/rules";

import { PriceAndButton, ProductCover, ProductKind } from "@/components/store/layouts/parts";
import type { StoreLayoutProps } from "@/components/store/layouts/types";
import { PriceTag } from "@/components/store/price-tag";
import { StoreHeader } from "@/components/store/store-header";
import { StoreFrame, cardStyle } from "@/components/store/store-theme";

/**
 * Neo-Brutalist (D-065): thick black borders, big hard shadows, a loud accent band and price
 * "stickers" on the covers. Text on the accent uses the accent's own readable text color.
 */
export function BrutalistLayout({ store, products, theme, preview }: StoreLayoutProps) {
  const { preset } = theme;
  const { before, after } = splitBlocks(store.pageBlocks);
  const ink = { borderColor: preset.text };

  return (
    <StoreFrame theme={theme} preview={preview} wide slug={store.slug}>
      <div className="flex w-full flex-col gap-8">
        <div className="flex flex-col gap-4 p-6 @3xl:p-8" style={cardStyle(theme)}>
          <StoreHeader store={store} align="start" />
        </div>

        <p className="-mx-1 border-y-[3px] px-4 py-3 font-display text-h3 tracking-tight uppercase" style={{ ...ink, background: theme.accent, color: theme.onAccent, fontWeight: preset.displayWeight }}>
          {products.length} {products.length === 1 ? "product" : "products"} · new drops
        </p>

        <StoreBlocks blocks={before} theme={theme} />
        {products.length === 0 ? (
          <p className="p-6 text-center font-semibold" style={cardStyle(theme)}>
            Products are coming soon. Check back later.
          </p>
        ) : (
          <ul className="grid gap-6 @2xl:grid-cols-2 @4xl:grid-cols-3">
            {products.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/@${store.slug}/${product.slug}`}
                  className="flex h-full flex-col overflow-hidden transition-transform duration-(--dur-fast) hover:-translate-x-0.5 hover:-translate-y-0.5"
                  style={cardStyle(theme)}
                >
                  <span className="relative block border-b-[3px]" style={ink}>
                    <ProductCover product={product} theme={theme} className="aspect-[4/3]" />
                    <span
                      className="absolute top-3 left-3 -rotate-3 border-[3px] px-3 py-1 font-display text-money-m"
                      style={{ ...ink, background: theme.accent, color: theme.onAccent, borderRadius: 4 }}
                    >
                      {product.priceCents === 0 ? "Free" : <PriceTag product={product} currency={store.currency} />}
                    </span>
                  </span>
                  <span className="flex flex-1 flex-col gap-2 p-5">
                    <ProductKind product={product} theme={theme} />
                    <span className="font-display text-h3 tracking-tight break-words uppercase" style={{ fontWeight: preset.displayWeight }}>
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
        <StoreBlocks blocks={after} theme={theme} />
      </div>
    </StoreFrame>
  );
}
