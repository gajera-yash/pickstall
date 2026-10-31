import Link from "next/link";

import { SOCIAL_ICONS } from "@/components/dashboard/social-icons";
import { StoreFrame, cardStyle, resolveTheme } from "@/components/store/store-theme";
import { safeImageSrc } from "@/lib/media/media";
import { SOCIAL_LINK_LABELS } from "@/lib/config";
import { formatMoney } from "@/lib/products/money";
import type { PublicProduct, PublicStore } from "@/lib/stores/public";

export function priceLabel(product: Pick<PublicProduct, "pricingModel" | "priceCents" | "minPriceCents">, currency: string): string {
  if (product.pricingModel === "pwyw") return (product.minPriceCents ?? 0) === 0 ? "Pay what you want" : `From ${formatMoney(product.minPriceCents ?? 0, currency)}`;
  return product.priceCents === 0 ? "Free" : formatMoney(product.priceCents, currency);
}

/** Avatar, name, bio and social links. Shared by the store page and the product page header. */
export function StoreHeader({ store, linkToStore }: { store: PublicStore; linkToStore?: boolean }) {
  const { preset, accent, onAccent } = resolveTheme(store.theme);
  const initial = store.name.trim().charAt(0).toUpperCase() || "?";
  const body = (
    <>
      {safeImageSrc(store.avatarUrl) ? (
        // A creator's own https link on any host, so next/image (fixed remote hosts) cannot load it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={safeImageSrc(store.avatarUrl) ?? ""} alt="" referrerPolicy="no-referrer" className="size-24 rounded-full object-cover" />
      ) : (
        <span aria-hidden="true" className="flex size-24 items-center justify-center rounded-full font-display text-h1" style={{ background: accent, color: onAccent }}>
          {initial}
        </span>
      )}
      <span className="font-display text-h1 break-words" style={{ fontWeight: preset.displayWeight }}>
        {store.name}
      </span>
    </>
  );

  return (
    <header className="flex flex-col items-center gap-3 text-center">
      {linkToStore ? (
        <Link href={`/@${store.slug}`} className="flex flex-col items-center gap-3">
          {body}
        </Link>
      ) : (
        <h1 className="flex flex-col items-center gap-3">{body}</h1>
      )}
      {store.bio && (
        <p className="max-w-md text-body-l break-words whitespace-pre-line" style={{ color: preset.muted }}>
          {store.bio}
        </p>
      )}
      {store.socialLinks.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-2">
          {store.socialLinks.map((link) => {
            const Icon = SOCIAL_ICONS[link.kind];
            return (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  aria-label={`${SOCIAL_LINK_LABELS[link.kind]} (opens in a new tab)`}
                  className="flex size-11 items-center justify-center rounded-full border"
                  style={{ borderColor: preset.muted, color: preset.text }}
                >
                  <Icon aria-hidden="true" className="size-5" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </header>
  );
}

/** Public store page (PRD F2): header, then one card per published product. */
export function StorePage({ store, products }: { store: PublicStore; products: PublicProduct[] }) {
  const theme = resolveTheme(store.theme);
  const { preset } = theme;

  return (
    <StoreFrame theme={theme}>
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
                  <span className="font-display text-money-m tabular-nums">{priceLabel(product, store.currency)}</span>
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
