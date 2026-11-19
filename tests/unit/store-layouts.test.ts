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

const store: PublicStore = { id: "s1", slug: "maya", name: "Maya", bio: "Design lessons", avatarUrl: null, socialLinks: [], theme: { preset: "clean", accent: "#0056FF" }, currency: "usd", isOpen: true, pixels: null, pageBlocks: [] };
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

  it("draws page sections above and below the products in every theme (D-101)", () => {
    const pageBlocks = [
      { id: "intro001", type: "text" as const, heading: "Start here", body: "Intro text" },
      { id: "products1", type: "products" as const },
      { id: "quote001", type: "testimonial" as const, quote: "Best course", name: "Asha" },
    ];
    for (const preset of THEME_PRESET_IDS) {
      const html = renderToStaticMarkup(createElement(StorePage, { store: { ...store, pageBlocks, theme: { preset, accent: THEME_PRESETS[preset].accent } }, products: [product] }));
      const intro = html.indexOf("Start here");
      const productAt = html.indexOf("UI course");
      const quote = html.indexOf("Best course");
      expect(intro, preset).toBeGreaterThan(-1);
      expect(intro, preset).toBeLessThan(productAt);
      expect(quote, preset).toBeGreaterThan(productAt);
    }
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

describe("Editorial Luxury and Neon Bento (D-064)", () => {
  const second: PublicProduct = { ...product, id: "p3", slug: "workbook", title: "Brand workbook", type: "digital", course: null };
  const render = (preset: "editorial" | "neon", preview = false) =>
    renderToStaticMarkup(createElement(StorePage, { store: { ...store, theme: { preset, accent: THEME_PRESETS[preset].accent } }, products: [product, second], preview }));

  it("Editorial features the first product, lists the rest, and uses the serif", () => {
    const page = render("editorial");
    expect(page).toContain("Featured");
    expect(page).toContain("More from Maya");
    expect(page.indexOf("UI course")).toBeLessThan(page.indexOf("Brand workbook"));
    expect(page).toContain("--font-bricolage:var(--font-store-serif)");
    expect(render("editorial", true)).not.toContain("<main");
  });

  it("Neon Bento makes the first product a big tile and glows in the accent", () => {
    const page = render("neon");
    expect(page).toContain("@4xl:row-span-2");
    expect(page).toContain("background:#0B0B12");
    expect(page).toContain(`color-mix(in srgb, ${THEME_PRESETS.neon.accent} 22%, transparent)`);
    expect(render("neon", true)).not.toContain("<main");
  });
});

describe("Neo-Brutalist and Frosted Glass (D-065)", () => {
  const render = (preset: "brutalist" | "glass", preview = false) =>
    renderToStaticMarkup(createElement(StorePage, { store: { ...store, theme: { preset, accent: THEME_PRESETS[preset].accent } }, products: [product], preview }));

  it("Neo-Brutalist uses thick ink borders, block shadows and a price sticker", () => {
    const page = render("brutalist");
    expect(page).toContain(`box-shadow:6px 6px 0 ${THEME_PRESETS.brutalist.text}`);
    expect(page).toContain("1 product · new drops");
    expect(page).toContain("-rotate-3");
    expect(render("brutalist", true)).not.toContain("<main");
  });

  it("Frosted Glass draws a gradient page with blurred see-through cards", () => {
    const page = render("glass");
    expect(page).toContain("linear-gradient(135deg");
    expect(page).toContain("backdrop-filter:blur(18px) saturate(140%)");
    expect(page).toContain(`color-mix(in srgb, ${THEME_PRESETS.glass.card} 62%, transparent)`);
    expect(render("glass", true)).not.toContain("<main");
  });
});

describe("Clean, Bold and Soft on wide pages (D-066)", () => {
  const second: PublicProduct = { ...product, id: "p3", slug: "workbook", title: "Brand workbook", type: "digital", course: null };
  const render = (preset: "clean" | "bold" | "soft") =>
    renderToStaticMarkup(createElement(StorePage, { store: { ...store, theme: { preset, accent: THEME_PRESETS[preset].accent } }, products: [product, second] }));

  it("keeps the phone column and adds a banner header and product grid only at @3xl", () => {
    for (const preset of ["clean", "bold", "soft"] as const) {
      const page = render(preset);
      expect(page).toContain("max-w-xl");
      expect(page).toContain("@3xl:max-w-5xl");
      expect(page).toContain("@3xl:grid-cols-2");
      expect(page).toContain("@5xl:grid-cols-3");
      expect(page).toContain("@3xl:flex-row");
      expect(page).toContain("mt-auto");
    }
  });

  it("does not change the centered header used elsewhere (product page)", async () => {
    const { StoreHeader } = await import("@/components/store/store-header");
    const header = renderToStaticMarkup(createElement(StoreHeader, { store }));
    expect(header).toContain("items-center text-center");
    expect(header).not.toContain("@3xl:");
  });
});
