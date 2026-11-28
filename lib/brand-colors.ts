import type { SocialLinkKind } from "@/lib/config";

/**
 * Official brand colors of the social platforms (D-046), from Simple Icons' data with each brand's
 * guidelines (Meta, YouTube, LinkedIn). Raw colors are allowed only here, in styles/tokens.css, lib/themes.ts
 * and lib/email/templates.ts (tests/unit/tokens.test.ts). TikTok and X are black and use the ink token instead.
 */
export const SOCIAL_BRAND_COLORS: Partial<Record<SocialLinkKind, string>> = {
  instagram: "#FF0069",
  facebook: "#0866FF",
  youtube: "#FF0000",
  linkedin: "#0A66C2",
};

/**
 * Colors of Pickstall's own share image (/og.png). The image is drawn as a picture, where CSS
 * variables do not exist, so these repeat the light-theme values of styles/tokens.css.
 */
export const SHARE_IMAGE_COLORS = { background: "#ffffff", ink: "#0b0d2a", mute: "#5b6078", blue: "#0056ff", yellow: "#ffc400" } as const;

/**
 * The two looks of the daily social post images (D-136), used on alternating days. Drawn as pictures
 * (next/og), so they repeat brand values instead of CSS variables: white with blue accents, and brand
 * blue with yellow accents.
 */
export const POST_IMAGE_THEMES = {
  white: {
    background: "#ffffff",
    backgroundImage: "linear-gradient(160deg, #ffffff 0%, #f3f7ff 100%)",
    ink: "#0b0d2a",
    mute: "#5b6078",
    accent: "#0056ff",
    onAccent: "#ffffff",
    highlight: "#ffc400",
    onHighlight: "#0b0d2a",
    shape: "#e3ecff",
    shapeSoft: "#fff4cc",
    dots: "#c9d8ff",
    phone: "#0b0d2a",
    screen: "#ffffff",
    card: "#f1f5ff",
    cardLine: "#d6e1ff",
    phoneShadow: "0 30px 60px rgba(11, 13, 42, 0.35)",
  },
  blue: {
    background: "#0056ff",
    backgroundImage: "linear-gradient(160deg, #0a63ff 0%, #0040c4 100%)",
    ink: "#ffffff",
    mute: "#d6e3ff",
    accent: "#ffc400",
    onAccent: "#0b0d2a",
    highlight: "#ffffff",
    onHighlight: "#0040c4",
    shape: "#2b78ff",
    shapeSoft: "#0a4fd8",
    dots: "#4f8eff",
    phone: "#0b0d2a",
    screen: "#ffffff",
    card: "#f1f5ff",
    cardLine: "#d6e1ff",
    phoneShadow: "0 30px 60px rgba(11, 13, 42, 0.35)",
  },
} as const;
