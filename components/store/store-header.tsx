import Link from "next/link";

import { SocialLogo } from "@/components/brand/social-logos";
import { resolveTheme } from "@/components/store/store-theme";
import { SOCIAL_LINK_LABELS } from "@/lib/config";
import { safeImageSrc } from "@/lib/media/media";
import type { PublicStore } from "@/lib/stores/public";
import { cn } from "@/lib/utils";

/**
 * Avatar, name, bio and social links. Shared by the store page and the product page header.
 * `banner` is centered like `center` until the page is wide (@3xl), then the photo sits beside the
 * name and everything lines up on the left (D-066).
 */
export function StoreHeader({ store, linkToStore, align: layoutAlign = "center" }: { store: PublicStore; linkToStore?: boolean; align?: "center" | "start" | "banner" }) {
  const { preset, accent, onAccent, header } = resolveTheme(store.theme);
  // The creator's own choice (D-123) wins over the layout's.
  const align = header.align === "center" ? "center" : header.align === "left" ? "start" : layoutAlign;
  const start = align === "start";
  const banner = align === "banner";
  const initial = store.name.trim().charAt(0).toUpperCase() || "?";
  // A soft ring in the creator's accent around the photo.
  const ring = { boxShadow: `0 0 0 4px ${preset.background}, 0 0 0 7px color-mix(in srgb, ${accent} 35%, transparent)` };
  const body = (
    <>
      {safeImageSrc(store.avatarUrl) ? (
        // A creator's own https link on any host, so next/image (fixed remote hosts) cannot load it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={safeImageSrc(store.avatarUrl) ?? ""} alt="" referrerPolicy="no-referrer" className="size-24 shrink-0 rounded-full object-cover" style={ring} />
      ) : (
        <span aria-hidden="true" className="flex size-24 shrink-0 items-center justify-center rounded-full font-display text-h1" style={{ background: accent, color: onAccent, ...ring }}>
          {initial}
        </span>
      )}
      <span className="font-display text-h1 break-words" style={{ fontWeight: preset.displayWeight }}>
        {store.name}
      </span>
    </>
  );

  return (
    <header className={cn("flex flex-col gap-3", start ? "items-start text-left" : "items-center text-center", banner && "@3xl:items-start @3xl:text-left")}>
      {linkToStore ? (
        <Link href={`/@${store.slug}`} className={cn("flex flex-col gap-3", start ? "items-start" : "items-center", banner && "@3xl:flex-row @3xl:gap-5")}>
          {body}
        </Link>
      ) : (
        <h1 className={cn("flex flex-col gap-3", start ? "items-start" : "items-center", banner && "@3xl:flex-row @3xl:gap-5")}>{body}</h1>
      )}
      {store.bio && (
        <p className={cn("max-w-md text-body-l break-words whitespace-pre-line", banner && "@3xl:max-w-2xl")} style={{ color: preset.muted }}>
          {store.bio}
        </p>
      )}
      {header.showSocial && store.socialLinks.length > 0 && (
        <ul className={cn("flex flex-wrap gap-2", start ? "justify-start" : "justify-center", banner && "@3xl:justify-start")}>
          {/* Saved links are https or mailto only (lib/stores/schemas.ts); anything else is skipped here too. */}
          {store.socialLinks
            .filter((link) => /^(https:|mailto:)/i.test(link.url))
            .map((link) => {
              const email = link.kind === "email";
              return (
                <li key={link.url}>
                  <a
                    href={link.url}
                    {...(email ? {} : { target: "_blank", rel: "noopener noreferrer nofollow" })}
                    aria-label={email ? "Email" : `${SOCIAL_LINK_LABELS[link.kind]} (opens in a new tab)`}
                    className="flex size-11 items-center justify-center rounded-full border transition-transform duration-(--dur-fast) hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:hover:translate-y-0"
                    style={{ borderColor: `color-mix(in srgb, ${preset.text} 22%, transparent)`, color: preset.text, background: `color-mix(in srgb, ${preset.card} 70%, transparent)` }}
                  >
                    {/* Theme-colored logos, so they always match the creator's page. */}
                    <SocialLogo kind={link.kind} />
                  </a>
                </li>
              );
            })}
        </ul>
      )}
    </header>
  );
}
