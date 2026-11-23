import { Fraunces, JetBrains_Mono, Playfair_Display, Poppins, Space_Grotesk } from "next/font/google";

import type { HeadingFont } from "@/lib/store-design/rules";

// Headline fonts for store pages. Self-hosted by next/font like the app's own fonts; none is
// preloaded, so a store only fetches the one font its theme or custom design (D-123) uses.

// The serif for store themes that ask for it (displayFont "serif", D-062).
export const storeSerif = Fraunces({ subsets: ["latin"], axes: ["opsz"], variable: "--font-store-serif", display: "swap", preload: false });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-store-playfair", display: "swap", preload: false });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-store-grotesk", display: "swap", preload: false });
const poppins = Poppins({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-store-poppins", display: "swap", preload: false });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-store-mono", display: "swap", preload: false });

/**
 * The class that defines a custom headline font and the CSS variable it sets. "sans" is the app's
 * own display font (already on every page), so it needs neither.
 */
export const STORE_FONTS: Record<Exclude<HeadingFont, "theme">, { className: string; cssVar: string | null }> = {
  sans: { className: "", cssVar: null },
  serif: { className: storeSerif.variable, cssVar: "var(--font-store-serif)" },
  playfair: { className: playfair.variable, cssVar: "var(--font-store-playfair)" },
  grotesk: { className: grotesk.variable, cssVar: "var(--font-store-grotesk)" },
  poppins: { className: poppins.variable, cssVar: "var(--font-store-poppins)" },
  mono: { className: mono.variable, cssVar: "var(--font-store-mono)" },
};
