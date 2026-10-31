import type { CSSProperties, ReactNode } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { THEME_PRESETS, onAccentFor, type ThemePreset } from "@/lib/themes";

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

/** Full-page frame of a public store page: the creator's background and text color, a narrow column, a Pickstall footer. */
export function StoreFrame({ theme, children }: { theme: StoreTheme; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-8 sm:py-12" style={{ background: theme.preset.background, color: theme.preset.text }}>
      <main id="main" className="flex w-full max-w-xl flex-1 flex-col items-center gap-6">
        {children}
      </main>
      <footer className="flex items-center gap-2 pt-10 text-xs" style={{ color: theme.preset.muted }}>
        Powered by
        <Wordmark className="h-5" />
      </footer>
    </div>
  );
}
