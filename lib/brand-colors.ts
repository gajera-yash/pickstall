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
