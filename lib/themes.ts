import { contrastRatio } from "@/lib/contrast";

// Creator storefront themes (DESIGN.md section 11). Themes are data, not code: adding a preset
// means adding an entry here. Raw color values are allowed in this file only (and styles/tokens.css).
// Every pair below is contrast-tested in tests/unit/themes.test.ts.

export const THEME_PRESET_IDS = ["clean", "bold", "soft", "studio", "academy", "editorial", "neon", "brutalist", "glass"] as const;
export type ThemePresetId = (typeof THEME_PRESET_IDS)[number];

/** The classic one-column themes, which the landing page demos draw (they do not draw the newer layouts). */
export const CLASSIC_THEME_IDS = ["clean", "bold", "soft"] as const satisfies readonly ThemePresetId[];

/**
 * How a theme arranges the store page (H4, D-062). "stack" is the original single column; the new
 * themes bring their own layouts (split, editorial, bento, academy, ...) in components/store/layouts.
 */
export const STORE_LAYOUTS = ["stack", "split", "academy", "editorial", "bento", "brutalist", "glass"] as const;
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
  /** "soft" is a faint line in the theme's own text color, for dark themes (D-064). */
  border: { widthPx: 0 | 1 | 2 | 3; color: "line" | "ink" | "soft" | "none" };
  /** "glow" is a neon halo in the accent color (D-064); "block" a big hard shadow (D-065). */
  shadow: "none" | "hard" | "soft" | "glow" | "block";
  /**
   * A gradient page instead of the flat background (D-065), as its color stops. `background` stays
   * the flat fallback. Every stop is contrast-tested like the background.
   */
  pageGradient?: readonly string[];
  /** See-through cards (D-065): the card color at this opacity over a blurred page. Contrast is tested on the mix over every gradient stop. */
  glassOpacity?: number;
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
  // Editorial Luxury (D-064): minimalist luxury. Cream paper, serif headlines, thin rules, a
  // featured product, then the rest as a list.
  editorial: {
    id: "editorial",
    name: "Editorial Luxury",
    background: "#FAF6EE",
    text: "#1F1A14",
    muted: "#6B5D4C",
    accent: "#7A4E24",
    onAccent: "#FFFFFF",
    card: "#FFFDF8",
    radiusPx: 2,
    border: { widthPx: 1, color: "line" },
    shadow: "none",
    displayWeight: 600,
    layout: "editorial",
    displayFont: "serif",
  },
  // Neon Bento (D-064): cyberpunk / dark neon. A near-black page, mixed-size tiles, a glowing accent.
  neon: {
    id: "neon",
    name: "Neon Bento",
    background: "#0B0B12",
    text: "#F5F5FA",
    muted: "#A6A6BC",
    accent: "#22D3EE",
    onAccent: "#0B0D2A",
    card: "#15151F",
    radiusPx: 18,
    border: { widthPx: 1, color: "soft" },
    shadow: "glow",
    displayWeight: 800,
    layout: "bento",
    displayFont: "sans",
  },
  // Neo-Brutalist (D-065): thick black borders, big hard shadows, loud colors, chunky type.
  brutalist: {
    id: "brutalist",
    name: "Neo-Brutalist",
    background: "#FFF4D6",
    text: "#111111",
    muted: "#3F3B33",
    accent: "#FF4F8B",
    onAccent: "#0B0D2A",
    card: "#FFFFFF",
    radiusPx: 6,
    border: { widthPx: 3, color: "ink" },
    shadow: "block",
    displayWeight: 800,
    layout: "brutalist",
    displayFont: "sans",
  },
  // Frosted Glass (D-065): glassmorphism. See-through, blurred cards over a soft pastel gradient.
  glass: {
    id: "glass",
    name: "Frosted Glass",
    background: "#E0E7FF",
    text: "#1E1B4B",
    muted: "#4A4769",
    accent: "#6D28D9",
    onAccent: "#FFFFFF",
    card: "#FFFFFF",
    radiusPx: 22,
    border: { widthPx: 1, color: "soft" },
    shadow: "soft",
    displayWeight: 800,
    layout: "glass",
    displayFont: "sans",
    pageGradient: ["#E0E7FF", "#FCE7F3", "#D1FAE5", "#C7D2FE"],
    glassOpacity: 0.62,
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
