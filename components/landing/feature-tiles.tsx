"use client";

import { useId, useState } from "react";

import { PriceTag } from "@/components/store/price-tag";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
      <ToggleGroup type="single" variant="outline" aria-label="Store theme" value={themeId} onValueChange={(value) => value && setThemeId(value as ThemePresetId)} className="flex-wrap gap-2">
        {THEME_PRESET_IDS.map((id) => (
          <ToggleGroupItem key={id} value={id} className="min-h-11 rounded-full px-4">
            {THEME_PRESETS[id].name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
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

/** Discount (D-047): turning it on shows the discounted price with the regular one struck through. */
export function DiscountTile() {
  const id = useId();
  const [on, setOn] = useState(true);
  const product = { priceCents: 2900, salePriceCents: on ? 1900 : null };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          Add a discount
        </label>
        <Switch id={id} checked={on} onCheckedChange={setOn} />
      </div>
      <p className="flex items-center justify-between gap-3 rounded-md border border-line bg-bg-subtle px-3 py-2.5" aria-live="polite">
        <span className="text-sm font-semibold">Budget workbook</span>
        <PriceTag product={product} currency="usd" className="font-display text-money-m" regularClassName="text-mute" />
      </p>
      <p className="text-xs text-mute">Example. Buyers pay the discounted price.</p>
    </div>
  );
}
