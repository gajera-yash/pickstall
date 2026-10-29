import { SOCIAL_ICONS } from "@/components/dashboard/social-icons";
import { SOCIAL_LINK_LABELS, storeLink, type SocialLinkKind } from "@/lib/config";
import { THEME_PRESETS, onAccentFor, type ThemePresetId } from "@/lib/themes";
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

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Only a well-formed https link is shown as an image (the same rule the server applies). */
function safeImageUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Live phone preview of the public store (DESIGN.md 10.3, 10.4, 11): avatar, name, bio, social
 * icons and an example product card in the creator's theme. Colors come from the theme data in
 * lib/themes.ts, never from tokens, because this is the creator's page, not the app.
 * Decorative for screen readers; the form next to it holds the real values.
 */
export function StorePreview({ data, className }: { data: StorePreviewData; className?: string }) {
  const theme = THEME_PRESETS[data.themePreset];
  const accent = HEX.test(data.accent) ? data.accent : theme.accent;
  const onAccent = onAccentFor(accent).color;
  const avatar = safeImageUrl(data.avatarUrl);
  const initial = data.name.trim().charAt(0).toUpperCase() || "?";
  const cardStyle = {
    background: theme.card,
    borderRadius: theme.radiusPx,
    border: theme.border.widthPx ? `${theme.border.widthPx}px solid ${theme.border.color === "ink" ? theme.text : "var(--line)"}` : "none",
    boxShadow: theme.shadow === "hard" ? `4px 4px 0 ${theme.text}` : theme.shadow === "soft" ? "var(--shadow-popover)" : "none",
  };

  return (
    <div aria-hidden="true" className={cn("mx-auto w-full max-w-[340px] rounded-lg border border-line bg-surface p-2.5", className)}>
      <div
        className="flex min-h-[560px] flex-col items-center gap-3 overflow-hidden rounded-md px-5 pt-8 pb-5 text-center"
        style={{ background: theme.background, color: theme.text }}
      >
        {avatar ? (
          // A creator's own https link on any host, so next/image (fixed remote hosts) cannot load it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" referrerPolicy="no-referrer" className="size-18 rounded-full object-cover" />
        ) : (
          <span className="flex size-18 items-center justify-center rounded-full font-display text-h2" style={{ background: accent, color: onAccent }}>
            {initial}
          </span>
        )}
        <p className="font-display text-h3 break-words" style={{ fontWeight: theme.displayWeight }}>
          {data.name.trim() || "Your store name"}
        </p>
        {data.bio.trim() && (
          <p className="text-sm break-words whitespace-pre-line" style={{ color: theme.muted }}>
            {data.bio}
          </p>
        )}
        {data.socialLinks.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-3">
            {data.socialLinks.map((link, index) => {
              const Icon = SOCIAL_ICONS[link.kind];
              return (
                <li key={`${link.kind}-${index}`} title={SOCIAL_LINK_LABELS[link.kind]}>
                  <Icon className="size-6" />
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-2 flex w-full flex-col gap-3 p-4 text-left" style={cardStyle}>
          <span className="self-start rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: theme.background, color: theme.muted }}>
            Example product
          </span>
          <p className="font-display text-h4">Your first product</p>
          <p className="text-sm" style={{ color: theme.muted }}>
            Products you add will show up here.
          </p>
          <span
            className="flex h-11 items-center justify-center text-button"
            style={{ background: accent, color: onAccent, borderRadius: Math.min(theme.radiusPx, 12) }}
          >
            Buy now
          </span>
        </div>

        <p className="mt-auto pt-4 text-xs" style={{ color: theme.muted }}>
          {storeLink(data.slug)}
        </p>
      </div>
    </div>
  );
}
