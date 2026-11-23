import { z } from "zod";

import { AA_TEXT, contrastRatio } from "@/lib/contrast";
import { imageField } from "@/lib/stores/schemas";
import { STORE_LAYOUTS, type StoreLayout, type ThemePreset } from "@/lib/themes";

// Custom store design (D-123). Pure and client-safe: the Customize panel, the server and the store
// page use the same rules. A design is a set of optional overrides on top of the chosen theme; a
// missing field keeps the theme's own value. Only fixed options and #RRGGBB colors: no CSS, no HTML.

export const HEADING_FONTS = ["theme", "sans", "serif", "playfair", "grotesk", "poppins", "mono"] as const;
export type HeadingFont = (typeof HEADING_FONTS)[number];
export const HEADING_FONT_LABELS: Record<HeadingFont, string> = {
  theme: "Theme font",
  sans: "Modern sans",
  serif: "Classic serif",
  playfair: "Elegant serif",
  grotesk: "Techy grotesk",
  poppins: "Friendly round",
  mono: "Typewriter mono",
};

export const BACKGROUND_KINDS = ["theme", "solid", "gradient", "image"] as const;
export const BUTTON_SHAPES = ["theme", "square", "rounded", "pill"] as const;
export const BUTTON_STYLES = ["filled", "outline"] as const;
export const CARD_BORDERS = ["theme", "none", "thin", "thick"] as const;
export const CARD_SHADOWS = ["theme", "none", "soft", "hard"] as const;
export const HEADER_ALIGNS = ["theme", "center", "left"] as const;
export const PRODUCT_VIEWS = ["grid", "list"] as const;
export const LAYOUT_CHOICES = ["theme", ...STORE_LAYOUTS] as const;
export const LAYOUT_LABELS: Record<(typeof LAYOUT_CHOICES)[number], string> = {
  theme: "Theme layout",
  stack: "Stack",
  split: "Split",
  academy: "Academy",
  editorial: "Editorial",
  bento: "Bento",
  brutalist: "Poster",
  glass: "Glass",
};

/** The image behind the page is dimmed with the background color at this opacity, so text stays readable. */
export const IMAGE_OVERLAY = 0.82;
export const RADIUS_MAX = 24;

const hex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, { error: "Pick a color." })
  .transform((value) => value.toUpperCase());
const optionalHex = z.union([z.literal(""), hex]).transform((value) => (value === "" ? null : value));

export const storeDesignInput = z
  .object({
    colors: z.object({ background: optionalHex, text: optionalHex, muted: optionalHex, card: optionalHex }),
    background: z.object({
      kind: z.enum(BACKGROUND_KINDS),
      gradient: z.tuple([optionalHex, optionalHex]),
      image: imageField("Background image"),
    }),
    font: z.enum(HEADING_FONTS),
    headingWeight: z.union([z.literal("theme"), z.literal(600), z.literal(800)]),
    radius: z.union([z.literal("theme"), z.number().int().min(0).max(RADIUS_MAX)]),
    border: z.enum(CARD_BORDERS),
    shadow: z.enum(CARD_SHADOWS),
    layout: z.enum(LAYOUT_CHOICES),
    button: z.object({ shape: z.enum(BUTTON_SHAPES), style: z.enum(BUTTON_STYLES) }),
    header: z.object({ align: z.enum(HEADER_ALIGNS), cover: imageField("Cover image"), showSocial: z.boolean() }),
    productView: z.enum(PRODUCT_VIEWS),
  })
  .transform((input) => ({
    colors: input.colors,
    background: { kind: input.background.kind, gradient: input.background.gradient, image: input.background.image ?? null },
    font: input.font,
    headingWeight: input.headingWeight,
    radius: input.radius,
    border: input.border,
    shadow: input.shadow,
    layout: input.layout,
    button: input.button,
    header: { align: input.header.align, cover: input.header.cover ?? null, showSocial: input.header.showSocial },
    productView: input.productView,
  }));

export type StoreDesign = z.output<typeof storeDesignInput>;
/** What the Customize form edits (images as strings, "" for none). */
export type StoreDesignForm = z.input<typeof storeDesignInput>;

/** A design that changes nothing: every field follows the theme. */
export const EMPTY_DESIGN: StoreDesign = {
  colors: { background: null, text: null, muted: null, card: null },
  background: { kind: "theme", gradient: [null, null], image: null },
  font: "theme",
  headingWeight: "theme",
  radius: "theme",
  border: "theme",
  shadow: "theme",
  layout: "theme",
  button: { shape: "theme", style: "filled" },
  header: { align: "theme", cover: null, showSocial: true },
  productView: "grid",
};

/** The saved design as the form shows it. */
export function designToForm(design: StoreDesign | null | undefined): StoreDesignForm {
  const d = design ?? EMPTY_DESIGN;
  return {
    colors: { background: d.colors.background ?? "", text: d.colors.text ?? "", muted: d.colors.muted ?? "", card: d.colors.card ?? "" },
    background: { kind: d.background.kind, gradient: [d.background.gradient[0] ?? "", d.background.gradient[1] ?? ""], image: d.background.image ?? "" },
    font: d.font,
    headingWeight: d.headingWeight,
    radius: d.radius,
    border: d.border,
    shadow: d.shadow,
    layout: d.layout,
    button: { ...d.button },
    header: { align: d.header.align, cover: d.header.cover ?? "", showSocial: d.header.showSocial },
    productView: d.productView,
  };
}

/** The theme's look with the creator's overrides applied (colors, gradient, corners, border, shadow, layout, weight). */
export function applyDesign(preset: ThemePreset, design: StoreDesign | null | undefined): ThemePreset {
  if (!design) return preset;
  const c = design.colors;
  const next: ThemePreset = {
    ...preset,
    background: c.background ?? preset.background,
    text: c.text ?? preset.text,
    muted: c.muted ?? preset.muted,
    card: c.card ?? preset.card,
  };
  const kind = design.background.kind;
  if (kind === "solid" || kind === "image") {
    next.pageGradient = undefined;
  } else if (kind === "gradient") {
    const [from, to] = design.background.gradient;
    next.pageGradient = from && to ? [from, to] : preset.pageGradient;
  }
  // Own card colors are solid: a see-through glass card would mix with an unknown page.
  if (c.card || kind !== "theme") next.glassOpacity = undefined;
  if (design.radius !== "theme") next.radiusPx = design.radius;
  if (design.border !== "theme") next.border = design.border === "none" ? { widthPx: 0, color: "none" } : design.border === "thin" ? { widthPx: 1, color: "soft" } : { widthPx: 2, color: "ink" };
  if (design.shadow !== "theme") next.shadow = design.shadow;
  if (design.headingWeight !== "theme") next.displayWeight = design.headingWeight;
  if (design.layout !== "theme") next.layout = design.layout as StoreLayout;
  return next;
}

/** Where text has to stay readable: the page (every gradient stop) and the cards. */
function surfaces(preset: ThemePreset): { label: string; color: string }[] {
  const page = preset.pageGradient && preset.pageGradient.length > 0 ? preset.pageGradient.map((color) => ({ label: "background", color })) : [{ label: "background", color: preset.background }];
  return [...page, { label: "card color", color: preset.card }];
}

/**
 * The first readability problem of a design on a theme, or null. Text and secondary text need
 * 4.5:1 (WCAG AA) on the background, every gradient color and the cards; an outline button needs
 * its accent text at 4.5:1 on the cards. A background image is dimmed with the background color,
 * so the background color is what is checked.
 */
export function designContrastProblem(preset: ThemePreset, accent: string, design: StoreDesign): { field: string; message: string } | null {
  const merged = applyDesign(preset, design);
  for (const surface of surfaces(merged)) {
    if (contrastRatio(merged.text, surface.color) < AA_TEXT) return { field: "colors.text", message: `Text is hard to read on the ${surface.label}. Pick a darker or lighter text color.` };
    if (contrastRatio(merged.muted, surface.color) < AA_TEXT) return { field: "colors.muted", message: `Secondary text is hard to read on the ${surface.label}. Pick a stronger color.` };
  }
  if (design.button.style === "outline" && contrastRatio(accent, merged.card) < AA_TEXT) {
    return { field: "button.style", message: "Outline buttons use your accent color as text, and it is hard to read on your cards. Use filled buttons or another accent." };
  }
  return null;
}

/** Saved designs read back from the database are checked again; a broken one is ignored. */
export function safeDesign(raw: unknown): StoreDesign | null {
  if (!raw || typeof raw !== "object") return null;
  try {
    const parsed = storeDesignInput.safeParse(designToForm(raw as StoreDesign));
    return parsed.success ? parsed.data : null;
  } catch {
    // A document missing parts of the design shape.
    return null;
  }
}
