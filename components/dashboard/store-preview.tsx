import { ImageIcon } from "lucide-react";

import { SocialLogo } from "@/components/brand/social-logos";
import { cardStyle, resolveTheme } from "@/components/store/store-theme";
import { priceLabel } from "@/components/store/store-page";
import { APP_NAME, SOCIAL_LINK_LABELS, storeLink, type SocialLinkKind } from "@/lib/config";
import { safeImageSrc } from "@/lib/media/media";
import type { ThemePresetId } from "@/lib/themes";
import { cn } from "@/lib/utils";

export type StorePreviewData = {
  slug: string;
  name: string;
  bio: string;
  avatarUrl: string;
  socialLinks: { kind: SocialLinkKind; url: string }[];
  themePreset: ThemePresetId;
  accent: string;
};

/** A product as the preview shows it. Only published and draft products are passed in, never archived ones. */
export type PreviewProduct = {
  id: string;
  title: string;
  coverUrl: string | null;
  buttonText: string | null;
  pricingModel: "fixed" | "pwyw";
  priceCents: number;
  minPriceCents: number | null;
};

const MAX_PRODUCTS = 3;

/**
 * Live phone preview of the public store (DESIGN.md 10.3, 10.4, 11, D-045): a phone frame with the
 * creator's photo, name, bio and social icons, then their real products (up to three, priced with
 * the store page's own priceLabel), or an example card while there are none. Colors come from the
 * theme data through resolveTheme/cardStyle, the same as the public page, never from app tokens.
 * Decorative for screen readers; the form next to it holds the real values.
 */
export function StorePreview({
  data,
  products = [],
  currency = "usd",
  className,
}: {
  data: StorePreviewData;
  products?: PreviewProduct[];
  currency?: string;
  className?: string;
}) {
  const theme = resolveTheme({ preset: data.themePreset, accent: data.accent });
  const { preset, accent, onAccent } = theme;
  const avatar = safeImageSrc(data.avatarUrl);
  const initial = data.name.trim().charAt(0).toUpperCase() || "?";
  const buttonRadius = Math.min(preset.radiusPx, 12);
  const shown = products.slice(0, MAX_PRODUCTS);

  return (
    <div aria-hidden="true" className={cn("mx-auto w-full max-w-[320px]", className)}>
      <div className="rounded-[2.5rem] border border-line bg-surface p-2 shadow-popover">
        <div className="relative overflow-hidden rounded-[2rem]" style={{ background: preset.background, color: preset.text }}>
          <div className="absolute top-2 left-1/2 h-5 w-24 -translate-x-1/2 rounded-full bg-ink/90" />
          <div className="flex min-h-[540px] flex-col items-center gap-4 px-5 pt-12 pb-5 text-center">
            {avatar ? (
              // A creator's own https link on any host, so next/image (fixed remote hosts) cannot load it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" referrerPolicy="no-referrer" className="size-20 rounded-full object-cover" />
            ) : (
              <span className="flex size-20 items-center justify-center rounded-full font-display text-h1" style={{ background: accent, color: onAccent }}>
                {initial}
              </span>
            )}

            <div className="flex w-full flex-col gap-1.5">
              <p className="font-display text-h3 break-words" style={{ fontWeight: preset.displayWeight }}>
                {data.name.trim() || "Your store name"}
              </p>
              <p className="text-sm break-words whitespace-pre-line" style={{ color: preset.muted }}>
                {data.bio.trim() || "Your bio shows here."}
              </p>
            </div>

            {data.socialLinks.length > 0 && (
              <ul className="flex flex-wrap justify-center gap-2">
                {data.socialLinks.map((link, index) => {
                  return (
                    <li
                      key={`${link.kind}-${index}`}
                      title={SOCIAL_LINK_LABELS[link.kind]}
                      className="flex size-9 items-center justify-center rounded-full"
                      style={{ background: preset.card }}
                    >
                      <SocialLogo kind={link.kind} className="size-4" />
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-1 flex w-full flex-col gap-3 text-left">
              {shown.length === 0 ? (
                <div className="flex flex-col gap-3 p-3" style={cardStyle(theme)}>
                  <div className="flex items-center gap-3">
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-md" style={{ background: preset.background }}>
                      <ImageIcon className="size-5" style={{ color: preset.muted }} />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-xs font-semibold" style={{ color: preset.muted }}>
                        Example
                      </span>
                      <span className="font-display text-h4">Your first product</span>
                    </span>
                  </div>
                  <span className="flex h-10 items-center justify-center text-sm font-semibold" style={{ background: accent, color: onAccent, borderRadius: buttonRadius }}>
                    Buy now
                  </span>
                </div>
              ) : (
                shown.map((product) => {
                  const cover = safeImageSrc(product.coverUrl ?? "");
                  return (
                    <div key={product.id} className="flex flex-col gap-3 p-3" style={cardStyle(theme)}>
                      <div className="flex items-center gap-3">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cover} alt="" referrerPolicy="no-referrer" className="size-14 shrink-0 rounded-md object-cover" />
                        ) : (
                          <span className="flex size-14 shrink-0 items-center justify-center rounded-md" style={{ background: preset.background }}>
                            <ImageIcon className="size-5" style={{ color: preset.muted }} />
                          </span>
                        )}
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate font-semibold">{product.title.trim() || "Untitled product"}</span>
                          <span className="text-sm font-semibold tabular-nums" style={{ color: preset.muted }}>
                            {priceLabel(product, currency)}
                          </span>
                        </span>
                      </div>
                      <span
                        className="flex h-10 items-center justify-center truncate px-3 text-sm font-semibold"
                        style={{ background: accent, color: onAccent, borderRadius: buttonRadius }}
                      >
                        {product.buttonText?.trim() || "Buy now"}
                      </span>
                    </div>
                  );
                })
              )}
              {products.length > MAX_PRODUCTS && (
                <p className="text-center text-xs" style={{ color: preset.muted }}>
                  +{products.length - MAX_PRODUCTS} more
                </p>
              )}
            </div>

            <div className="mt-auto flex flex-col gap-1 pt-4 text-xs" style={{ color: preset.muted }}>
              <span className="font-semibold">{storeLink(data.slug)}</span>
              <span>Powered by {APP_NAME}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
