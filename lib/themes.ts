import { contrastRatio } from "@/lib/contrast";

// Creator storefront themes (DESIGN.md section 11). Themes are data, not code: adding a preset
// means adding an entry here. Raw color values are allowed in this file only (and styles/tokens.css).
// Every pair below is contrast-tested in tests/unit/themes.test.ts.

export const THEME_PRESET_IDS = ["clean", "bold", "soft", "studio", "academy"] as const;
export type ThemePresetId = (typeof THEME_PRESET_IDS)[number];

/** The classic one-column themes, which the landing page demos draw (they do not draw the newer layouts). */
export const CLASSIC_THEME_IDS = ["clean", "bold", "soft"] as const satisfies readonly ThemePresetId[];

/**
 * How a theme arranges the store page (H4, D-062). "stack" is the original single column; the new
 * themes bring their own layouts (split, editorial, bento, academy, ...) in components/store/layouts.
 */
export const STORE_LAYOUTS = ["stack", "split", "academy"] as const;
export type StoreLayout = (typeof STORE_LAYOUTS)[number];

export type ThemePreset = {
  id: ThemePresetId;
  name: string;
  background: string;
  text: string;
  muted: string;
  /** Default accent; the creator may pick another one (it must keep 4.5:1 with its on-accent color). */
  accent: string;
  onAccent: string;
  card: string;
  radiusPx: number;
  border: { widthPx: 0 | 1 | 2; color: "line" | "ink" | "none" };
  shadow: "none" | "hard" | "soft";
  displayWeight: 600 | 800;
  /** The page structure (D-062). */
  layout: StoreLayout;
  /** Headline font: our sans, or the serif loaded only for themes that use it. */
  displayFont: "sans" | "serif";
};

export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  clean: {
    id: "clean",
    name: "Clean",
    background: "#FFFFFF",
    text: "#0B0D2A",
    muted: "#5B6078",
    accent: "#0056FF",
    onAccent: "#FFFFFF",
    card: "#F7F8FA",
    radiusPx: 12,
    border: { widthPx: 1, color: "line" },
    shadow: "none",
    displayWeight: 800,
    layout: "stack",
    displayFont: "sans",
  },
  bold: {
    id: "bold",
    name: "Bold",
    background: "#FFD84D",
    text: "#0B0D2A",
    muted: "#2B2E55",
    accent: "#0B0D2A",
    onAccent: "#FFD84D",
    card: "#FFFFFF",
    radiusPx: 8,
    border: { widthPx: 2, color: "ink" },
    shadow: "hard",
    displayWeight: 800,
    layout: "stack",
    displayFont: "sans",
  },
  soft: {
    id: "soft",
    name: "Soft",
    background: "#FFF1EA",
    text: "#2B1A17",
    muted: "#6B4F47",
    accent: "#C2410C",
    onAccent: "#FFFFFF",
    card: "#FFFFFF",
    radiusPx: 24,
    border: { widthPx: 0, color: "none" },
    shadow: "soft",
    displayWeight: 600,
    layout: "stack",
    displayFont: "sans",
  },
  // Studio (D-063): calm and premium. A profile panel beside a grid of large product cards.
  studio: {
    id: "studio",
    name: "Studio",
    background: "#FAFAF7",
    text: "#1C1B19",
    muted: "#625F57",
    accent: "#2F5D50",
    onAccent: "#FFFFFF",
    card: "#FFFFFF",
    radiusPx: 16,
    border: { widthPx: 1, color: "line" },
    shadow: "none",
    displayWeight: 600,
    layout: "split",
    displayFont: "sans",
  },
  // Academy (D-063): a course catalog with category filters, lesson counts and access periods.
  academy: {
    id: "academy",
    name: "Academy",
    background: "#F4F6FF",
    text: "#0F172A",
    muted: "#475569",
    accent: "#4F46E5",
    onAccent: "#FFFFFF",
    card: "#FFFFFF",
    radiusPx: 14,
    border: { widthPx: 1, color: "line" },
    shadow: "soft",
    displayWeight: 800,
    layout: "academy",
    displayFont: "sans",
  },
};

/** Matches the `stores.theme` column default in the database. */
export const DEFAULT_THEME = { preset: "clean", accent: THEME_PRESETS.clean.accent } as const;

/** Text colors an accent can carry (DESIGN.md section 11): white or ink, whichever reads better. */
const ON_ACCENT_WHITE = "#FFFFFF";
const ON_ACCENT_INK = "#0B0D2A";

/**
 * The on-accent color for a creator's accent and its contrast ratio. Accents below 4.5:1 with
 * both choices are rejected by the store setup schema (lib/stores/schemas.ts).
 */
export function onAccentFor(accent: string): { color: string; ratio: number } {
  const white = { color: ON_ACCENT_WHITE, ratio: contrastRatio(ON_ACCENT_WHITE, accent) };
  const ink = { color: ON_ACCENT_INK, ratio: contrastRatio(ON_ACCENT_INK, accent) };
  return white.ratio >= ink.ratio ? white : ink;
}
