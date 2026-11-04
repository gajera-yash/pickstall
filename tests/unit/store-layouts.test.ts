import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// D-062: themes carry a layout and a headline font; the store page draws the theme's layout, and
// its preview version (the dashboard's live preview) has no <main> of its own.
vi.mock("@/components/store/fonts", () => ({ storeSerif: { variable: "font-store-serif-var" } }));
// next/image static imports need the Next.js build; the footer logo is not what is tested here.
vi.mock("@/components/brand/wordmark", () => ({ Wordmark: () => null }));
const db = vi.hoisted(() => ({ lessons: { aggregate: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));

import { StorePage } from "@/components/store/store-page";
import { frameStyle, resolveTheme } from "@/components/store/store-theme";
import { STORE_LAYOUTS, THEME_PRESETS, THEME_PRESET_IDS } from "@/lib/themes";
import { lessonCountsOf, type PublicProduct, type PublicStore } from "@/lib/stores/public";

const store: PublicStore = { id: "s1", slug: "maya", name: "Maya", bio: "Design lessons", avatarUrl: null, socialLinks: [], theme: { preset: "clean", accent: "#0056FF" }, currency: "usd" };
const product: PublicProduct = { id: "p1", slug: "ui-course", title: "UI course", description: "Learn UI", descriptionDoc: null, coverUrl: null, priceCents: 4900, salePriceCents: null, buttonText: "Enroll", type: "course", course: { category: "design", accessDays: null, lessonCount: 12 } };

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

describe("Studio and Academy (D-063)", () => {
  const download: PublicProduct = { ...product, id: "p2", slug: "presets", title: "Lightroom presets", type: "digital", course: null, priceCents: 0 };
  const render = (preset: "studio" | "academy", preview = false) =>
    renderToStaticMarkup(createElement(StorePage, { store: { ...store, theme: { preset, accent: THEME_PRESETS[preset].accent } }, products: [product, download], preview }));

  it("Studio puts the profile beside a grid of product cards", () => {
    const page = render("studio");
    expect(page).toContain("@3xl:grid-cols-[300px_minmax(0,1fr)]");
    expect(page).toContain("Course · 12 lessons");
    expect(page).toContain("Digital product");
    expect(page).toContain("2 products");
    expect(page).toContain(">Free<");
    expect(render("studio", true)).not.toContain("<main");
  });

  it("Academy shows real counts, category chips and course details", () => {
    const page = render("academy");
    expect(page).toContain("Filter by category");
    expect(page).toContain("Design");
    expect(page).toContain("Other products");
    expect(page).toContain("Lifetime access");
    expect(page).toContain("Course · 12 lessons");
    expect(page).toContain(">Enroll<");
    expect(render("academy", true)).not.toContain("<main");
  });

  it("counts lessons only for the store's courses", async () => {
    db.lessons.aggregate.mockReturnValue({ toArray: async () => [{ _id: "p1", count: 12 }] });
    expect(await lessonCountsOf("s1", [{ _id: "p1", type: "course" }, { _id: "p2", type: "digital" }])).toEqual(new Map([["p1", 12]]));
    expect(db.lessons.aggregate.mock.calls[0]?.[0][0]).toEqual({ $match: { storeId: "s1", productId: { $in: ["p1"] } } });
    db.lessons.aggregate.mockClear();
    expect(await lessonCountsOf("s1", [{ _id: "p2", type: "digital" }])).toEqual(new Map());
    expect(db.lessons.aggregate).not.toHaveBeenCalled();
  });
});
