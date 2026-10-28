import { contrastRatio } from "@/lib/contrast";

// Creator storefront themes (DESIGN.md section 11). Themes are data, not code: adding a preset
// means adding an entry here. Raw color values are allowed in this file only (and styles/tokens.css).
// Every pair below is contrast-tested in tests/unit/themes.test.ts.

export const THEME_PRESET_IDS = ["clean", "bold", "soft"] as const;
export type ThemePresetId = (typeof THEME_PRESET_IDS)[number];

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
};

export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  clean: {
    id: "clean",
    name: "Clean",
    background: "#FFFFFF",
    text: "#111322",
    muted: "#5B6078",
    accent: "#0056FF",
    onAccent: "#FFFFFF",
    card: "#F2F3FF",
    radiusPx: 14,
    border: { widthPx: 1, color: "line" },
    shadow: "none",
    displayWeight: 800,
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
