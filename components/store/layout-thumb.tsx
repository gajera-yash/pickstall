import type { CSSProperties } from "react";

import { borderColor } from "@/components/store/store-theme";
import type { ThemePreset } from "@/lib/themes";

/**
 * A small sketch of a theme's layout in the theme's own colors, for the theme picker (D-062).
 * Decorative: the theme's name is the label.
 */
export function LayoutThumb({ preset, className }: { preset: ThemePreset; className?: string }) {
  const card: CSSProperties = {
    background: preset.card,
    borderRadius: Math.min(preset.radiusPx / 3, 6),
    border: preset.border.widthPx ? `1px solid ${borderColor(preset)}` : "none",
  };
  const dot: CSSProperties = { background: preset.accent, borderRadius: 999 };

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        padding: 5,
        width: 64,
        height: 48,
        flexShrink: 0,
        borderRadius: 6,
        background: preset.background,
        ...(preset.pageGradient ? { backgroundImage: `linear-gradient(135deg, ${preset.pageGradient.join(", ")})` } : {}),
        border: "1px solid var(--line)",
        overflow: "hidden",
      }}
    >
      {preset.layout === "stack" && (
        <>
          <span style={{ ...dot, width: 9, height: 9 }} />
          <span style={{ ...card, width: "80%", height: 10 }} />
          <span style={{ ...card, width: "80%", height: 10 }} />
        </>
      )}
      {preset.layout === "split" && (
        <span style={{ display: "flex", gap: 3, width: "100%", flex: 1 }}>
          <span style={{ ...card, width: "34%", display: "flex", justifyContent: "center", paddingTop: 3 }}>
            <span style={{ ...dot, width: 7, height: 7 }} />
          </span>
          <span style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
            <span style={card} />
            <span style={card} />
            <span style={card} />
            <span style={card} />
          </span>
        </span>
      )}
      {preset.layout === "editorial" && (
        <>
          <span style={{ width: "70%", height: 4, borderTop: `1px solid ${preset.text}`, borderBottom: `1px solid ${preset.text}` }} />
          <span style={{ display: "flex", gap: 3, width: "100%", height: 16 }}>
            <span style={{ ...card, flex: 1.4 }} />
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, justifyContent: "center" }}>
              <span style={{ height: 3, background: preset.text, borderRadius: 2 }} />
              <span style={{ ...dot, height: 3, width: "60%" }} />
            </span>
          </span>
          <span style={{ width: "100%", height: 3, borderTop: `1px solid ${preset.muted}` }} />
          <span style={{ width: "100%", height: 3, borderTop: `1px solid ${preset.muted}` }} />
        </>
      )}
      {preset.layout === "bento" && (
        <span style={{ flex: 1, width: "100%", display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 3 }}>
          <span style={{ ...card, gridRow: "span 2", boxShadow: `0 0 4px ${preset.accent}` }} />
          <span style={card} />
          <span style={card} />
          <span style={{ ...card, gridColumn: "span 2" }} />
        </span>
      )}
      {preset.layout === "brutalist" && (
        <>
          <span style={{ ...card, width: "100%", height: 9, boxShadow: `2px 2px 0 ${preset.text}` }} />
          <span style={{ ...dot, width: "100%", height: 5, borderRadius: 0, borderTop: `1px solid ${preset.text}`, borderBottom: `1px solid ${preset.text}` }} />
          <span style={{ flex: 1, width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
            <span style={{ ...card, boxShadow: `2px 2px 0 ${preset.text}` }} />
            <span style={{ ...card, boxShadow: `2px 2px 0 ${preset.text}` }} />
            <span style={{ ...card, boxShadow: `2px 2px 0 ${preset.text}` }} />
          </span>
        </>
      )}
      {preset.layout === "glass" && (
        <>
          <span style={{ ...card, width: "70%", height: 11, display: "flex", justifyContent: "center", alignItems: "center", opacity: 0.75 }}>
            <span style={{ ...dot, width: 5, height: 5 }} />
          </span>
          <span style={{ flex: 1, width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
            <span style={{ ...card, opacity: 0.7 }} />
            <span style={{ ...card, opacity: 0.7 }} />
          </span>
        </>
      )}
      {preset.layout === "academy" && (
        <>
          <span style={{ ...card, width: "100%", height: 9, display: "flex", alignItems: "center", paddingLeft: 3 }}>
            <span style={{ ...dot, width: 5, height: 5 }} />
          </span>
          <span style={{ display: "flex", gap: 2, alignSelf: "flex-start" }}>
            <span style={{ ...dot, width: 10, height: 4 }} />
            <span style={{ ...card, width: 8, height: 4, borderRadius: 999 }} />
          </span>
          <span style={{ flex: 1, width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
            <span style={card} />
            <span style={card} />
            <span style={card} />
          </span>
        </>
      )}
    </span>
  );
}
