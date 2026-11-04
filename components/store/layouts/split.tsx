import Link from "next/link";

import { PriceAndButton, ProductCover, ProductKind } from "@/components/store/layouts/parts";
import type { StoreLayoutProps } from "@/components/store/layouts/types";
import { StoreHeader } from "@/components/store/store-header";
import { StoreFrame, cardStyle } from "@/components/store/store-theme";

/**
 * Studio (D-063): the profile in a panel that stays put on wide screens, beside a grid of large
 * product cards. On a phone the panel comes first, then one card per row.
 */
export function SplitLayout({ store, products, theme, preview }: StoreLayoutProps) {
  const { preset } = theme;

  return (
    <StoreFrame theme={theme} preview={preview} wide>
      <div className="grid w-full gap-6 @3xl:grid-cols-[300px_minmax(0,1fr)] @3xl:items-start @3xl:gap-10">
        <aside className="flex flex-col gap-5 p-6 @3xl:sticky @3xl:top-8" style={cardStyle(theme)}>
          <StoreHeader store={store} align="start" />
          <p className="border-t pt-4 text-sm" style={{ borderColor: "var(--line)", color: preset.muted }}>
            {products.length} {products.length === 1 ? "product" : "products"}
          </p>
        </aside>

        <section aria-labelledby="studio-products" className="flex min-w-0 flex-col gap-4">
          <h2 id="studio-products" className="font-display text-h3" style={{ fontWeight: preset.displayWeight }}>
            Products
          </h2>
          {products.length === 0 ? (
            <p className="p-6" style={{ ...cardStyle(theme), color: preset.muted }}>
              Products are coming soon. Check back later.
            </p>
          ) : (
            <ul className="grid gap-5 @2xl:grid-cols-2">
              {products.map((product) => (
                <li key={product.id}>
                  <Link href={`/@${store.slug}/${product.slug}`} className="flex h-full flex-col overflow-hidden" style={cardStyle(theme)}>
                    <ProductCover product={product} theme={theme} className="aspect-[4/3]" />
                    <span className="flex flex-1 flex-col gap-2 p-5">
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
        </section>
      </div>
    </StoreFrame>
  );
}
