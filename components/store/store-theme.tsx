import type { CSSProperties, ReactNode } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { STORE_FONTS } from "@/components/store/fonts";
import { safeImageSrc } from "@/lib/media/media";
import { EMPTY_DESIGN, IMAGE_OVERLAY, applyDesign, designContrastProblem, safeDesign, type HeadingFont, type StoreDesign } from "@/lib/store-design/rules";
import { badgeHref } from "@/lib/marketing/acquisition";
import { THEME_PRESETS, onAccentFor, type ThemePreset } from "@/lib/themes";
import { cn } from "@/lib/utils";

/**
 * The creator's theme as plain values. Colors come from theme data in lib/themes.ts, never from app
 * tokens. `preset` already has the creator's custom design (D-123) applied; the other fields are
 * the custom choices a preset has no field for.
 */
export type StoreTheme = {
  preset: ThemePreset;
  accent: string;
  onAccent: string;
  font: Exclude<HeadingFont, "theme">;
  button: StoreDesign["button"];
  header: StoreDesign["header"];
  backgroundImage: string | null;
  productView: StoreDesign["productView"];
};

export function resolveTheme(theme: { preset: keyof typeof THEME_PRESETS; accent: string; custom?: StoreDesign | null }): StoreTheme {
  const base = THEME_PRESETS[theme.preset] ?? THEME_PRESETS.clean;
  const accent = /^#[0-9a-fA-F]{6}$/.test(theme.accent) ? theme.accent : base.accent;
  let design = safeDesign(theme.custom) ?? EMPTY_DESIGN;
  // Colors chosen for another theme or accent can become hard to read: then the theme's own colors
  // and background are used, and the rest of the design stays (D-123).
  if (designContrastProblem(base, accent, design)) design = { ...design, colors: EMPTY_DESIGN.colors, background: EMPTY_DESIGN.background, button: { ...design.button, style: "filled" } };
  const preset = applyDesign(base, design);
  return {
    preset,
    accent,
    onAccent: onAccentFor(accent).color,
    font: design.font === "theme" ? base.displayFont : design.font,
    button: design.button,
    header: { ...design.header, cover: safeImageSrc(design.header.cover ?? "") },
    backgroundImage: design.background.kind === "image" ? safeImageSrc(design.background.image ?? "") : null,
    productView: design.productView,
  };
}

/** A creator's button (D-123): the shape and filled or outline style they chose, else the theme's corners. */
export function buttonStyle(theme: StoreTheme): CSSProperties {
  const { shape, style } = theme.button;
  const borderRadius = shape === "square" ? 0 : shape === "rounded" ? 10 : shape === "pill" ? 999 : Math.min(theme.preset.radiusPx, 12);
  return style === "outline" ? { background: "transparent", color: theme.accent, border: `2px solid ${theme.accent}`, borderRadius } : { background: theme.accent, color: theme.onAccent, borderRadius };
}

/** The color of a preset's card border (D-064: "soft" is its own text color, faintly). */
export function borderColor(preset: ThemePreset): string {
  if (preset.border.color === "ink") return preset.text;
  if (preset.border.color === "soft") return `color-mix(in srgb, ${preset.text} 14%, transparent)`;
  return "var(--line)";
}

/** Card look of a preset: radius, border and shadow (the neon glow uses the creator's accent). */
export function cardStyle({ preset, accent }: StoreTheme): CSSProperties {
  const shadows = {
    none: "none",
    hard: `4px 4px 0 ${preset.text}`,
    soft: "var(--shadow-popover)",
    glow: `0 0 0 1px color-mix(in srgb, ${accent} 30%, transparent), 0 8px 32px color-mix(in srgb, ${accent} 22%, transparent)`,
    block: `6px 6px 0 ${preset.text}`,
  };
  // Glass (D-065): the card color, partly see-through, over a blurred page.
  const glass = preset.glassOpacity
    ? { background: `color-mix(in srgb, ${preset.card} ${Math.round(preset.glassOpacity * 100)}%, transparent)`, backdropFilter: "blur(18px) saturate(140%)", WebkitBackdropFilter: "blur(18px) saturate(140%)" }
    : { background: preset.card };
  return {
    ...glass,
    borderRadius: preset.radiusPx,
    border: preset.border.widthPx ? `${preset.border.widthPx}px solid ${borderColor(preset)}` : "none",
    boxShadow: shadows[preset.shadow],
  };
}

/**
 * The page style of a theme: its colors, the background (gradient or the creator's image, dimmed
 * with the background color so text stays readable, D-123) and the headline font (D-062).
 */
export function frameStyle({ preset, font, backgroundImage }: StoreTheme): { className: string; style: CSSProperties } {
  const headline = STORE_FONTS[font];
  const overlay = `color-mix(in srgb, ${preset.background} ${Math.round(IMAGE_OVERLAY * 100)}%, transparent)`;
  const image = backgroundImage
    ? { backgroundImage: `linear-gradient(${overlay}, ${overlay}), url("${backgroundImage.replace(/["\\\n]/g, "")}")`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "scroll" }
    : preset.pageGradient
      ? // A gradient page (D-065) over the flat color, which stays as the fallback.
        { backgroundImage: `linear-gradient(135deg, ${preset.pageGradient.join(", ")})` }
      : {};
  return {
    className: headline.className,
    // font-display reads --font-bricolage (globals.css); another headline font points it elsewhere, on this page only.
    style: {
      background: preset.background,
      ...image,
      color: preset.text,
      ...(headline.cssVar ? ({ "--font-bricolage": headline.cssVar } as CSSProperties) : {}),
    },
  };
}

/**
 * Full-page frame of a public store page: the creator's background and text color, a column
 * (narrow, or wide for layouts that use the desktop width), a Pickstall footer. With `preview` it
 * renders as a plain block for the dashboard's live preview (no page height, no second <main>).
 */
/** `slug` tags the "Powered by" link with this store (D-119); the dashboard preview shows no link. */
export function StoreFrame({ theme, children, wide = false, preview = false, slug }: { theme: StoreTheme; children: ReactNode; wide?: boolean; preview?: boolean; slug?: string }) {
  const frame = frameStyle(theme);
  const Body = preview ? "div" : "main";
  return (
    // @container: layouts size themselves by this frame's width, so the scaled dashboard preview
    // shows the phone or desktop layout it pretends to be (D-063).
    <div className={cn("@container flex flex-col items-center px-4 py-8 sm:py-12", !preview && "min-h-dvh", frame.className)} style={frame.style}>
      <Body {...(preview ? {} : { id: "main" })} className={cn("flex w-full flex-1 flex-col items-center gap-6", wide ? "max-w-6xl" : "max-w-xl")}>
        {theme.header.cover && (
          // The creator's cover image (D-123): an upload or https link on any host, so next/image cannot load it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={theme.header.cover} alt="" referrerPolicy="no-referrer" className="aspect-[3/1] w-full object-cover" style={{ borderRadius: theme.preset.radiusPx }} />
        )}
        {children}
      </Body>
      <footer className="flex items-center gap-2 pt-10 text-xs" style={{ color: theme.preset.muted }}>
        Powered by
        {/* On live store pages the logo link is tagged with this store (D-119); the preview keeps plain "/". */}
        <Wordmark className="h-5" href={preview ? "/" : badgeHref(slug)} />
      </footer>
    </div>
  );
}
