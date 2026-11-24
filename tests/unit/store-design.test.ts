import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// D-123: the creator's custom design on top of the theme, section styles, and saving it.

const db = vi.hoisted(() => ({ stores: { updateOne: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/components/store/fonts", () => {
  const font = (name: string) => ({ className: `font-${name}-var`, cssVar: `var(--font-store-${name})` });
  return { storeSerif: { variable: "font-store-serif-var" }, STORE_FONTS: { sans: { className: "", cssVar: null }, serif: font("serif"), playfair: font("playfair"), grotesk: font("grotesk"), poppins: font("poppins"), mono: font("mono") } };
});
vi.mock("@/components/brand/wordmark", () => ({ Wordmark: () => null }));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: () => false }));

import { StoreBlocks } from "@/components/store/store-blocks";
import { buttonStyle, frameStyle, resolveTheme } from "@/components/store/store-theme";
import { pageBlocksInput } from "@/lib/page-blocks/rules";
import { EMPTY_DESIGN, applyDesign, designContrastProblem, designToForm, safeDesign, storeDesignInput, type StoreDesign } from "@/lib/store-design/rules";
import { updateStoreDesign } from "@/lib/stores/queries";
import { THEME_PRESETS } from "@/lib/themes";

const form = (change: (value: ReturnType<typeof designToForm>) => void = () => {}) => {
  const value = designToForm(null);
  change(value);
  return value;
};
const design = (change?: (value: ReturnType<typeof designToForm>) => void): StoreDesign => storeDesignInput.parse(form(change));

describe("custom design rules", () => {
  it("accepts only fixed options, #RRGGBB colors and safe images", () => {
    expect(storeDesignInput.parse(form())).toEqual(EMPTY_DESIGN);
    expect(storeDesignInput.safeParse(form((f) => (f.colors.text = "red"))).success).toBe(false);
    expect(storeDesignInput.safeParse(form((f) => (f.colors.text = "#111"))).success).toBe(false);
    expect(storeDesignInput.safeParse(form((f) => (f.background.image = "javascript:alert(1)"))).success).toBe(false);
    expect(storeDesignInput.safeParse(form((f) => (f.radius = 40))).success).toBe(false);
    expect(storeDesignInput.safeParse({ ...form(), font: "comic" }).success).toBe(false);
    expect(design((f) => (f.colors.text = "#1a1a1a")).colors.text).toBe("#1A1A1A");
    expect(design((f) => (f.header.cover = "/media/0b8f4b52-8d6c-4f6d-9d0e-3c3d6f1b2a10")).header.cover).toBe("/media/0b8f4b52-8d6c-4f6d-9d0e-3c3d6f1b2a10");
  });

  it("applies overrides on the theme and leaves the rest alone", () => {
    const clean = THEME_PRESETS.clean;
    expect(applyDesign(clean, EMPTY_DESIGN)).toEqual(clean);
    const merged = applyDesign(
      THEME_PRESETS.glass,
      design((f) => {
        f.colors.card = "#FFFFFF";
        f.radius = 0;
        f.border = "thick";
        f.shadow = "hard";
        f.layout = "bento";
        f.headingWeight = 600;
        f.background = { kind: "gradient", gradient: ["#FFFFFF", "#F1F5F9"], image: "" };
      }),
    );
    expect(merged).toMatchObject({ card: "#FFFFFF", radiusPx: 0, border: { widthPx: 2, color: "ink" }, shadow: "hard", layout: "bento", displayWeight: 600, pageGradient: ["#FFFFFF", "#F1F5F9"] });
    // An own card color is solid, never see-through glass.
    expect(merged.glassOpacity).toBeUndefined();
  });

  it("refuses hard-to-read text, secondary text and outline buttons", () => {
    const clean = THEME_PRESETS.clean;
    expect(designContrastProblem(clean, "#0056FF", EMPTY_DESIGN)).toBeNull();
    expect(designContrastProblem(clean, "#0056FF", design((f) => (f.colors.text = "#DDDDDD")))?.field).toBe("colors.text");
    expect(designContrastProblem(clean, "#0056FF", design((f) => (f.colors.muted = "#CCCCCC")))?.field).toBe("colors.muted");
    // Every gradient stop is checked.
    expect(designContrastProblem(clean, "#0056FF", design((f) => (f.background = { kind: "gradient", gradient: ["#FFFFFF", "#111111"], image: "" })))?.field).toBe("colors.text");
    expect(designContrastProblem(clean, "#FFD600", design((f) => (f.button.style = "outline")))?.field).toBe("button.style");
  });

  it("ignores a broken saved design", () => {
    expect(safeDesign(null)).toBeNull();
    expect(safeDesign({ font: "serif" })).toBeNull();
    expect(safeDesign({ ...EMPTY_DESIGN, colors: { ...EMPTY_DESIGN.colors, text: "url(x)" } })).toBeNull();
    expect(safeDesign(EMPTY_DESIGN)).toEqual(EMPTY_DESIGN);
  });
});

describe("the design on the store page", () => {
  it("uses the creator's font, image background and button shape", () => {
    const theme = resolveTheme({
      preset: "clean",
      accent: "#0056FF",
      custom: design((f) => {
        f.font = "playfair";
        f.background = { kind: "image", gradient: ["", ""], image: "/media/0b8f4b52-8d6c-4f6d-9d0e-3c3d6f1b2a10" };
        f.button = { shape: "pill", style: "outline" };
      }),
    });
    const frame = frameStyle(theme);
    expect(frame.className).toBe("font-playfair-var");
    expect(frame.style).toMatchObject({ "--font-bricolage": "var(--font-store-playfair)" });
    expect(String(frame.style.backgroundImage)).toContain('url("/media/0b8f4b52-8d6c-4f6d-9d0e-3c3d6f1b2a10")');
    expect(buttonStyle(theme)).toEqual({ background: "transparent", color: "#0056FF", border: "2px solid #0056FF", borderRadius: 999 });
  });

  it("falls back to the theme colors when saved colors no longer read well", () => {
    // Saved for a light theme, now on the dark Neon theme: the text color would vanish.
    const theme = resolveTheme({ preset: "neon", accent: THEME_PRESETS.neon.accent, custom: design((f) => { f.colors.text = "#111111"; f.radius = 4; }) });
    expect(theme.preset.text).toBe(THEME_PRESETS.neon.text);
    expect(theme.preset.radiusPx).toBe(4);
  });
});

describe("section styles", () => {
  const products = { id: "products1", type: "products" as const };
  it("saves only a non-default look and draws it", () => {
    const parsed = pageBlocksInput.parse([
      { id: "text0001", type: "text", heading: "", body: "Hello", style: { box: "none", align: "center", spacing: "roomy" } },
      { id: "text0002", type: "text", heading: "", body: "Plain", style: { box: "card", align: "left", spacing: "normal" } },
      products,
    ]);
    expect(parsed[0]).toMatchObject({ style: { box: "none", align: "center", spacing: "roomy" } });
    expect(parsed[1]).not.toHaveProperty("style");
    expect(pageBlocksInput.safeParse([{ id: "text0001", type: "text", heading: "", body: "x", style: { box: "neon", align: "left", spacing: "normal" } }, products]).success).toBe(false);

    const html = renderToStaticMarkup(createElement(StoreBlocks, { blocks: parsed.slice(0, 1), theme: resolveTheme({ preset: "clean", accent: "#0056FF" }) }));
    expect(html).toContain("text-center");
    expect(html).toContain("py-6");
  });
});

describe("saving the design (owner filter)", () => {
  beforeEach(() => vi.clearAllMocks());
  it("writes only the owner's store and only the custom field", async () => {
    db.stores.updateOne.mockResolvedValue({ matchedCount: 1 });
    expect(await updateStoreDesign("user-a", EMPTY_DESIGN)).toBe(true);
    const [filter, update] = db.stores.updateOne.mock.calls[0] ?? [];
    expect(filter).toEqual({ ownerId: "user-a" });
    expect(update.$set["theme.custom"]).toEqual(EMPTY_DESIGN);
    expect(update.$set).not.toHaveProperty("theme");
    db.stores.updateOne.mockResolvedValue({ matchedCount: 0 });
    expect(await updateStoreDesign("user-b", null)).toBe(false);
  });
});
