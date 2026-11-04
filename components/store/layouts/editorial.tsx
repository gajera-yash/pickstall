import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { PriceAndButton, ProductCover, ProductKind } from "@/components/store/layouts/parts";
import type { StoreLayoutProps } from "@/components/store/layouts/types";
import { StoreHeader } from "@/components/store/store-header";
import { StoreFrame, borderColor, cardStyle } from "@/components/store/store-theme";
import { PriceTag } from "@/components/store/price-tag";

/**
 * Editorial Luxury (D-064): a magazine page. A centered masthead between thin rules, the first
 * product as a wide featured story, then the rest as a quiet list. Headlines use the serif.
 */
export function EditorialLayout({ store, products, theme, preview }: StoreLayoutProps) {
  const { preset } = theme;
  const rule = { borderColor: borderColor(preset) };
  const [featured, ...rest] = products;

  return (
    <StoreFrame theme={theme} preview={preview} wide>
      <div className="flex w-full max-w-4xl flex-col gap-10 @3xl:gap-14">
        <div className="border-y py-8 @3xl:py-12" style={rule}>
          <StoreHeader store={store} />
        </div>

        {!featured ? (
          <p className="text-center text-body-l" style={{ color: preset.muted }}>
            New work is coming soon.
          </p>
        ) : (
          <>
            <section aria-labelledby="editorial-featured" className="flex flex-col gap-4">
              <h2 id="editorial-featured" className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: preset.muted }}>
                Featured
              </h2>
              <Link href={`/@${store.slug}/${featured.slug}`} className="grid overflow-hidden @3xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" style={cardStyle(theme)}>
                <ProductCover product={featured} theme={theme} className="aspect-[4/3] h-full" />
                <span className="flex flex-col justify-center gap-4 p-6 @3xl:p-10">
                  <ProductKind product={featured} theme={theme} />
                  <span className="font-display text-h1 leading-tight break-words" style={{ fontWeight: preset.displayWeight }}>
                    {featured.title}
                  </span>
                  {featured.description && (
                    <span className="line-clamp-4 text-body-l break-words" style={{ color: preset.muted }}>
                      {featured.description}
                    </span>
                  )}
                  <PriceAndButton product={featured} theme={theme} currency={store.currency} />
                </span>
              </Link>
            </section>

            {rest.length > 0 && (
              <section aria-labelledby="editorial-more" className="flex flex-col gap-2">
                <h2 id="editorial-more" className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: preset.muted }}>
                  More from {store.name}
                </h2>
                <ul className="flex flex-col border-t" style={rule}>
                  {rest.map((product) => (
                    <li key={product.id} className="border-b" style={rule}>
                      <Link href={`/@${store.slug}/${product.slug}`} className="group flex items-center gap-4 py-5">
                        <ProductCover product={product} theme={theme} className="aspect-square w-20 shrink-0 @xl:w-24" />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <ProductKind product={product} theme={theme} />
                          <span className="font-display text-h3 break-words" style={{ fontWeight: preset.displayWeight }}>
                            {product.title}
                          </span>
                          <span className="font-display text-money-m">
                            {product.priceCents === 0 ? "Free" : <PriceTag product={product} currency={store.currency} regularStyle={{ color: preset.muted }} />}
                          </span>
                        </span>
                        <ArrowRight aria-hidden="true" className="size-5 shrink-0 transition-transform duration-(--dur-fast) group-hover:translate-x-1" style={{ color: theme.accent }} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </StoreFrame>
  );
}
