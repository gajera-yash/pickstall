import Link from "next/link";

import { SocialLogo } from "@/components/brand/social-logos";
import { resolveTheme } from "@/components/store/store-theme";
import { SOCIAL_LINK_LABELS } from "@/lib/config";
import { safeImageSrc } from "@/lib/media/media";
import type { PublicStore } from "@/lib/stores/public";

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
                    className="flex size-11 items-center justify-center rounded-full border"
                    style={{ borderColor: preset.muted, color: preset.text }}
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
