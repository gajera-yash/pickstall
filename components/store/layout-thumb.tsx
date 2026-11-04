import type { CSSProperties } from "react";

import type { ThemePreset } from "@/lib/themes";

/**
 * A small sketch of a theme's layout in the theme's own colors, for the theme picker (D-062).
 * Decorative: the theme's name is the label.
 */
export function LayoutThumb({ preset, className }: { preset: ThemePreset; className?: string }) {
  const card: CSSProperties = {
    background: preset.card,
    borderRadius: Math.min(preset.radiusPx / 3, 6),
    border: preset.border.widthPx ? `1px solid ${preset.border.color === "ink" ? preset.text : "var(--line)"}` : "none",
  };
  const dot: CSSProperties = { background: preset.accent, borderRadius: 999 };

  return (
    <span aria-hidden="true" className={className} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: 5, width: 64, height: 48, flexShrink: 0, borderRadius: 6, background: preset.background, border: "1px solid var(--line)", overflow: "hidden" }}>
      {preset.layout === "stack" && (
        <>
          <span style={{ ...dot, width: 9, height: 9 }} />
          <span style={{ ...card, width: "80%", height: 10 }} />
          <span style={{ ...card, width: "80%", height: 10 }} />
        </>
      )}
    </span>
  );
}
