"use client";

import { useId, useState } from "react";

import { formatMoney } from "@/lib/products/money";
import { THEME_PRESETS, THEME_PRESET_IDS, type ThemePresetId } from "@/lib/themes";
import { cn } from "@/lib/utils";

// Small live UIs inside the landing feature tiles. Example content only.

/** Re-skins a tiny store card with the three real storefront themes. */
export function ThemeTile() {
  const [themeId, setThemeId] = useState<ThemePresetId>("bold");
  const theme = THEME_PRESETS[themeId];
  const border = theme.border.widthPx ? `${theme.border.widthPx}px solid ${theme.border.color === "ink" ? theme.text : "var(--line)"}` : "none";

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Store theme" className="flex flex-wrap gap-2">
        {THEME_PRESET_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={id === themeId}
            onClick={() => setThemeId(id)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors duration-(--dur-fast)",
              id === themeId ? "border-blue bg-blue-soft text-ink" : "border-input bg-surface text-ink hover:bg-bg-subtle",
            )}
          >
            {THEME_PRESETS[id].name}
          </button>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="flex flex-col gap-2.5 p-4 transition-colors duration-(--dur-base)"
        style={{ background: theme.background, color: theme.text, borderRadius: theme.radiusPx + 4, border }}
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full text-sm font-extrabold" style={{ background: theme.accent, color: theme.onAccent }}>
            AL
          </span>
          <div>
            <p className="font-display text-base leading-tight" style={{ fontWeight: theme.displayWeight }}>
              Ava Lens Presets
            </p>
            <p className="text-xs" style={{ color: theme.muted }}>
              Photo presets and guides
            </p>
          </div>
        </div>
        {["Moody film presets", "Lightroom starter guide"].map((title, index) => (
          <div
            key={title}
            className="flex items-center justify-between gap-3 px-3 py-2.5"
            style={{
              background: theme.card,
              borderRadius: theme.radiusPx,
              border,
              boxShadow: theme.shadow === "hard" ? `3px 3px 0 ${theme.text}` : theme.shadow === "soft" ? "var(--shadow-popover)" : "none",
            }}
          >
            <span className="text-sm font-semibold">{title}</span>
            <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: theme.accent, color: theme.onAccent }}>
              {index === 0 ? "Get it" : "Buy $12"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Pay what you want: the buyer's slider changes the price chip, never below the creator's minimum. */
export function PwywTile() {
  const id = useId();
  const minimum = 500;
  const [cents, setCents] = useState(1500);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          Name your price
        </label>
        <span className="rounded-full bg-blue px-3 py-1 font-display text-sm font-extrabold text-on-blue tabular-nums">{formatMoney(cents, "usd")}</span>
      </div>
      <input
        id={id}
        type="range"
        min={minimum}
        max={5000}
        step={100}
        value={cents}
        onChange={(event) => setCents(Number(event.target.value))}
        aria-valuetext={formatMoney(cents, "usd")}
        className="h-11 w-full cursor-pointer accent-blue"
      />
      <p className="text-xs text-mute">Minimum {formatMoney(minimum, "usd")}, set by you.</p>
    </div>
  );
}
