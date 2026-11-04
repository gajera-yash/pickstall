import type { CSSProperties, ReactNode } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { storeSerif } from "@/components/store/fonts";
import { THEME_PRESETS, onAccentFor, type ThemePreset } from "@/lib/themes";
import { cn } from "@/lib/utils";

/** The creator's theme as plain values. Colors come from theme data in lib/themes.ts, never from app tokens. */
export type StoreTheme = {
  preset: ThemePreset;
  accent: string;
  onAccent: string;
};

export function resolveTheme(theme: { preset: keyof typeof THEME_PRESETS; accent: string }): StoreTheme {
  const preset = THEME_PRESETS[theme.preset] ?? THEME_PRESETS.clean;
  const accent = /^#[0-9a-fA-F]{6}$/.test(theme.accent) ? theme.accent : preset.accent;
  return { preset, accent, onAccent: onAccentFor(accent).color };
}

/** Card look of a preset: radius, border and shadow. */
export function cardStyle({ preset }: StoreTheme): CSSProperties {
  return {
    background: preset.card,
    borderRadius: preset.radiusPx,
    border: preset.border.widthPx ? `${preset.border.widthPx}px solid ${preset.border.color === "ink" ? preset.text : "var(--line)"}` : "none",
    boxShadow: preset.shadow === "hard" ? `4px 4px 0 ${preset.text}` : preset.shadow === "soft" ? "var(--shadow-popover)" : "none",
  };
}

/** The page style of a theme: its colors, and the serif headline font for themes that use it (D-062). */
export function frameStyle({ preset }: StoreTheme): { className: string; style: CSSProperties } {
  const serif = preset.displayFont === "serif";
  return {
    className: serif ? storeSerif.variable : "",
    // font-display reads --font-bricolage (globals.css); a serif theme points it at its serif, on its own page only.
    style: { background: preset.background, color: preset.text, ...(serif ? ({ "--font-bricolage": "var(--font-store-serif)" } as CSSProperties) : {}) },
  };
}

/**
 * Full-page frame of a public store page: the creator's background and text color, a column
 * (narrow, or wide for layouts that use the desktop width), a Pickstall footer. With `preview` it
 * renders as a plain block for the dashboard's live preview (no page height, no second <main>).
 */
export function StoreFrame({ theme, children, wide = false, preview = false }: { theme: StoreTheme; children: ReactNode; wide?: boolean; preview?: boolean }) {
  const frame = frameStyle(theme);
  const Body = preview ? "div" : "main";
  return (
    <div className={cn("flex flex-col items-center px-4 py-8 sm:py-12", !preview && "min-h-dvh", frame.className)} style={frame.style}>
      <Body {...(preview ? {} : { id: "main" })} className={cn("flex w-full flex-1 flex-col items-center gap-6", wide ? "max-w-6xl" : "max-w-xl")}>
        {children}
      </Body>
      <footer className="flex items-center gap-2 pt-10 text-xs" style={{ color: theme.preset.muted }}>
        Powered by
        <Wordmark className="h-5" />
      </footer>
    </div>
  );
}
