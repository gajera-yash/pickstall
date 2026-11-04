import Link from "next/link";

import { PriceTag } from "@/components/store/price-tag";
import { StoreHeader } from "@/components/store/store-header";
import { StoreFrame, cardStyle } from "@/components/store/store-theme";
import type { StoreLayoutProps } from "@/components/store/layouts/types";
import { safeImageSrc } from "@/lib/media/media";

/** The original single column (themes Clean, Bold, Soft): header, then one card per product. */
export function StackLayout({ store, products, theme, preview }: StoreLayoutProps) {
  const { preset } = theme;

  return (
    <StoreFrame theme={theme} preview={preview}>
      <StoreHeader store={store} />
      {products.length === 0 ? (
        <p className="w-full p-6 text-center" style={{ ...cardStyle(theme), color: preset.muted }}>
          Products are coming soon. Check back later.
        </p>
      ) : (
        <ul className="flex w-full flex-col gap-4">
          {products.map((product) => (
            <li key={product.id}>
              <Link href={`/@${store.slug}/${product.slug}`} className="flex flex-col gap-3 overflow-hidden p-4" style={cardStyle(theme)}>
                {safeImageSrc(product.coverUrl) && (
                  // A creator's own https link on any host, so next/image (fixed remote hosts) cannot load it.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={safeImageSrc(product.coverUrl) ?? ""} alt="" referrerPolicy="no-referrer" loading="lazy" className="aspect-video w-full rounded-md object-cover" />
                )}
                <span className="font-display text-h3 break-words" style={{ fontWeight: preset.displayWeight }}>
                  {product.title}
                </span>
                {product.description && (
                  <span className="line-clamp-2 text-sm break-words" style={{ color: preset.muted }}>
                    {product.description}
                  </span>
                )}
                <span className="flex items-center justify-between gap-3">
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
    </StoreFrame>
  );
}
