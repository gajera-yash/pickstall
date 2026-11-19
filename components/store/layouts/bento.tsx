import Link from "next/link";
import { StoreBlocks } from "@/components/store/store-blocks";
import { splitBlocks } from "@/lib/page-blocks/rules";

import { PriceAndButton, ProductCover, ProductKind } from "@/components/store/layouts/parts";
import type { StoreLayoutProps } from "@/components/store/layouts/types";
import { StoreHeader } from "@/components/store/store-header";
import { StoreFrame, cardStyle } from "@/components/store/store-theme";
import { cn } from "@/lib/utils";

/**
 * Neon Bento (D-064): a dark page of mixed-size tiles with a glowing accent. The profile is the
 * first tile; the first product is a big tile; the rest fill the grid. Text always sits on the
 * solid tile color, never on a picture, so it stays readable.
 */
export function BentoLayout({ store, products, theme, preview }: StoreLayoutProps) {
  const { preset } = theme;
  const { before, after } = splitBlocks(store.pageBlocks);

  return (
    <StoreFrame theme={theme} preview={preview} wide>
      <ul className="grid w-full auto-rows-auto gap-4 @2xl:grid-cols-2 @4xl:grid-cols-4">
        <li className="flex flex-col justify-center p-6 @4xl:col-span-2" style={cardStyle(theme)}>
          <StoreHeader store={store} align="start" />
        </li>

        {before.length > 0 && (
          <li className="@2xl:col-span-2 @4xl:col-span-4">
            <StoreBlocks blocks={before} theme={theme} />
          </li>
        )}

        {products.length === 0 && (
          <li className="flex items-center p-6 @4xl:col-span-2" style={{ ...cardStyle(theme), color: preset.muted }}>
            Products are coming soon. Check back later.
          </li>
        )}

        {products.map((product, index) => {
          const big = index === 0;
          return (
            <li key={product.id} className={cn(big && "@2xl:col-span-2 @4xl:row-span-2")}>
              <Link href={`/@${store.slug}/${product.slug}`} className="flex h-full flex-col overflow-hidden" style={cardStyle(theme)}>
                <ProductCover product={product} theme={theme} className={big ? "aspect-video @4xl:aspect-[16/11]" : "aspect-video"} />
                <span className="flex flex-1 flex-col gap-2 p-5">
                  <ProductKind product={product} theme={theme} />
                  <span className={cn("font-display break-words", big ? "text-h2" : "text-h3")} style={{ fontWeight: preset.displayWeight }}>
                    {product.title}
                  </span>
                  {big && product.description && (
                    <span className="line-clamp-3 text-sm break-words" style={{ color: preset.muted }}>
                      {product.description}
                    </span>
                  )}
                  <span className="mt-auto pt-2">
                    <PriceAndButton product={product} theme={theme} currency={store.currency} />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}

        {after.length > 0 && (
          <li className="@2xl:col-span-2 @4xl:col-span-4">
            <StoreBlocks blocks={after} theme={theme} />
          </li>
        )}
      </ul>
    </StoreFrame>
  );
}
