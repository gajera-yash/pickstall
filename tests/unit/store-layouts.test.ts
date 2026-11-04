import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// D-062: themes carry a layout and a headline font; the store page draws the theme's layout, and
// its preview version (the dashboard's live preview) has no <main> of its own.
vi.mock("@/components/store/fonts", () => ({ storeSerif: { variable: "font-store-serif-var" } }));
// next/image static imports need the Next.js build; the footer logo is not what is tested here.
vi.mock("@/components/brand/wordmark", () => ({ Wordmark: () => null }));

import { StorePage } from "@/components/store/store-page";
import { frameStyle, resolveTheme } from "@/components/store/store-theme";
import { STORE_LAYOUTS, THEME_PRESETS, THEME_PRESET_IDS } from "@/lib/themes";
import type { PublicProduct, PublicStore } from "@/lib/stores/public";

const store: PublicStore = { id: "s1", slug: "maya", name: "Maya", bio: "Design lessons", avatarUrl: null, socialLinks: [], theme: { preset: "clean", accent: "#0056FF" }, currency: "usd" };
const product: PublicProduct = { id: "p1", slug: "ui-course", title: "UI course", description: "Learn UI", descriptionDoc: null, coverUrl: null, priceCents: 4900, salePriceCents: null, buttonText: "Enroll", type: "course", course: { category: "design", accessDays: null } };

describe("store themes and layouts", () => {
  it("gives every theme a known layout and headline font", () => {
    for (const id of THEME_PRESET_IDS) {
      expect(STORE_LAYOUTS).toContain(THEME_PRESETS[id].layout);
      expect(["sans", "serif"]).toContain(THEME_PRESETS[id].displayFont);
    }
  });

  it("switches headlines to the serif only for serif themes", () => {
    const theme = resolveTheme({ preset: "clean", accent: "#0056FF" });
    expect(frameStyle(theme)).toEqual({ className: "", style: { background: "#FFFFFF", color: "#0B0D2A" } });
    const serif = frameStyle({ ...theme, preset: { ...theme.preset, displayFont: "serif" } });
    expect(serif.className).toBe("font-store-serif-var");
    expect(serif.style).toMatchObject({ "--font-bricolage": "var(--font-store-serif)" });
  });

  it("renders the public page with its <main>, and the preview without one", () => {
    const page = renderToStaticMarkup(createElement(StorePage, { store, products: [product] }));
    expect(page).toContain('<main id="main"');
    expect(page).toContain("UI course");
    expect(page).toContain('href="/@maya/ui-course"');
    const preview = renderToStaticMarkup(createElement(StorePage, { store, products: [product], preview: true }));
    expect(preview).not.toContain("<main");
    expect(preview).toContain("UI course");
  });
});
