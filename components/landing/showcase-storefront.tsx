"use client";

import { m } from "motion/react";
import { Check, Palette } from "lucide-react";
import { useState, type ReactNode } from "react";

import { SOCIAL_ICONS } from "@/components/dashboard/social-icons";
import { Tilt } from "@/components/landing/motion";
import { cardStyle, resolveTheme } from "@/components/store/store-theme";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { APP_NAME } from "@/lib/config";
import { THEME_PRESETS, THEME_PRESET_IDS, type ThemePresetId } from "@/lib/themes";
import { cn } from "@/lib/utils";

// Storefront preview (D-039): pick one of the three real store themes and an accent, and the phone
// re-skins with the same resolveTheme/cardStyle the public store page uses. Example content only.

const THEME_NOTES: Record<ThemePresetId, string> = {
  clean: "White and calm. Lets your products do the talking.",
  bold: "Loud color and hard edges. Made to stop the scroll.",
  soft: "Warm tones and round corners. Friendly and personal.",
};

/** The accents offered here are the presets' own, so every one already passes the contrast check. */
const ACCENTS = [...new Set(THEME_PRESET_IDS.map((id) => THEME_PRESETS[id].accent))];

const PRODUCTS = [
  { title: "Moody film presets", meta: "12 Lightroom presets", button: "Get the presets", price: "$15" },
  { title: "Lightroom starter guide", meta: "38-page PDF", button: "Buy the guide", price: "$12" },
  { title: "Editing workbook", meta: "On sale, was $9", button: "Get the workbook", price: "$5" },
];

/** `intro` is the section heading, placed above the theme picker so it sits beside the phone. */
export function StorefrontShowcase({ intro }: { intro: ReactNode }) {
  const [presetId, setPresetId] = useState<ThemePresetId>("clean");
  const [accent, setAccent] = useState<string | null>(null);
  // The cards fade in only after the visitor changes something, so the server render is final.
  const [touched, setTouched] = useState(false);
  const theme = resolveTheme({ preset: presetId, accent: accent ?? THEME_PRESETS[presetId].accent });
  const { preset } = theme;

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
      <div className="flex flex-col gap-8">
        {intro}
        <ToggleGroup
          type="single"
          variant="bare"
          aria-label="Store theme"
          value={presetId}
          onValueChange={(value) => {
            if (!value) return;
            setPresetId(value as ThemePresetId);
            setAccent(null);
            setTouched(true);
          }}
          className="w-full flex-col items-stretch gap-2"
        >
          {THEME_PRESET_IDS.map((id) => {
            const on = id === presetId;
            return (
              <ToggleGroupItem key={id} value={id} className="relative flex min-h-16 justify-start gap-4 rounded-md px-4 py-3 text-left text-base font-normal whitespace-normal text-ink hover:bg-bg-subtle">
                {on && (
                  <m.span
                    layoutId="theme-active"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-md border border-blue bg-blue-soft"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  />
                )}
                <span
                  aria-hidden="true"
                  className="relative size-9 shrink-0 rounded-full border border-line"
                  style={{ background: THEME_PRESETS[id].background, boxShadow: `inset 0 0 0 9px ${THEME_PRESETS[id].background}, inset 0 0 0 20px ${THEME_PRESETS[id].accent}` }}
                />
                <span className="relative flex min-w-0 flex-col">
                  <span className="font-semibold">{THEME_PRESETS[id].name}</span>
                  <span className="text-sm text-mute">{THEME_NOTES[id]}</span>
                </span>
                {on && <Check aria-hidden="true" className="relative ml-auto size-5 shrink-0 text-blue" />}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>

        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Palette aria-hidden="true" className="size-4 text-blue" />
            Accent color
          </span>
          <ToggleGroup
            type="single"
            variant="bare"
            aria-label="Accent color"
            value={ACCENTS.includes(theme.accent) ? theme.accent : ""}
            onValueChange={(value) => {
              if (!value) return;
              setAccent(value);
              setTouched(true);
            }}
            className="gap-2"
          >
            {ACCENTS.map((color, index) => {
              const on = theme.accent === color;
              return (
                <ToggleGroupItem key={color} value={color} aria-label={`Accent ${index + 1}`} className={cn("size-11 rounded-full border-2 px-0", on ? "border-blue" : "border-transparent")}>
                  <span aria-hidden="true" className="size-7 rounded-full border border-line" style={{ background: color }} />
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          <span className="text-xs text-mute">Or any color you like, as long as it stays readable.</span>
        </div>
      </div>

      <Tilt className="mx-auto w-full max-w-[20rem]">
        <div aria-hidden="true" className="relative rounded-[2.25rem] border-2 border-border-strong bg-surface p-2.5 shadow-hard-md">
          <div className="mx-auto mb-2.5 h-1.5 w-14 rounded-full bg-line" />
          <div
            className="flex min-h-[30rem] flex-col items-center gap-4 overflow-hidden rounded-[1.75rem] px-4 pt-7 pb-4 transition-colors duration-(--dur-slow)"
            style={{ background: preset.background, color: preset.text }}
          >
            <span className="flex size-16 items-center justify-center rounded-full font-display text-lg font-extrabold" style={{ background: theme.accent, color: theme.onAccent }}>
              AL
            </span>
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="font-display text-lg leading-tight" style={{ fontWeight: preset.displayWeight }}>
                Ava Lens Presets
              </p>
              <p className="text-xs" style={{ color: preset.muted }}>
                Film-look presets and editing guides
              </p>
            </div>
            <div className="flex gap-2">
              {(["instagram", "youtube", "website"] as const).map((kind) => {
                const Icon = SOCIAL_ICONS[kind];
                return <Icon key={kind} className="size-4" style={{ color: preset.muted }} />;
              })}
            </div>
            <div className="flex w-full flex-col gap-2.5">
              {PRODUCTS.map((product) => (
                <m.div key={`${presetId}-${product.title}`} initial={touched ? { opacity: 0.4, y: 4 } : false} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2.5 p-3" style={cardStyle(theme)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{product.title}</p>
                      <p className="text-xs" style={{ color: preset.muted }}>
                        {product.meta}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{product.price}</span>
                  </div>
                  <span
                    className="py-2 text-center text-xs font-semibold"
                    style={{ background: theme.accent, color: theme.onAccent, borderRadius: Math.max(6, preset.radiusPx - 4) }}
                  >
                    {product.button}
                  </span>
                </m.div>
              ))}
            </div>
            <p className="mt-auto text-[0.6875rem]" style={{ color: preset.muted }}>
              Powered by {APP_NAME}
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-center">
          <Badge variant="example">Example store</Badge>
        </div>
      </Tilt>
    </div>
  );
}
