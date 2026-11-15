import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// D-068: the product page shows the story and a buy box (side by side on wide pages), a store strip
// at the top and a phone buy bar only when the product can be bought.
vi.mock("@/components/store/fonts", () => ({ storeSerif: { variable: "font-store-serif-var" } }));
vi.mock("@/components/brand/wordmark", () => ({ Wordmark: () => null }));

import { ProductPage } from "@/components/store/product-page";
import type { PublicCurriculum, PublicProduct, PublicStore } from "@/lib/stores/public";

const store: PublicStore = { id: "s1", slug: "maya", name: "Maya", bio: "Design lessons", avatarUrl: null, socialLinks: [], theme: { preset: "clean", accent: "#0056FF" }, currency: "usd", isOpen: true };
const course: PublicProduct = { id: "p1", slug: "ui-course", title: "UI course", description: "Learn UI", descriptionDoc: null, coverUrl: null, priceCents: 4900, salePriceCents: null, buttonText: "Enroll", type: "course", course: { category: "design", accessDays: null, lessonCount: 3 } };
const ebook: PublicProduct = { ...course, id: "p2", slug: "ebook", title: "Ebook", buttonText: "", type: "digital", course: null };
const curriculum: PublicCurriculum = { modules: [{ title: "Start", lessons: [{ title: "Hello", hasVideo: true }, { title: "Notes", hasVideo: false }] }, { title: "Next", lessons: [{ title: "Grids", hasVideo: true }] }] };

const render = (product: PublicProduct, buyable: boolean, outline: PublicCurriculum | null = null) =>
  renderToStaticMarkup(createElement(ProductPage, { store, product, buyable, curriculum: outline }));

describe("product page (D-068)", () => {
  it("puts the buy box beside the story on wide pages and links to checkout", () => {
    const page = render(course, true, curriculum);
    expect(page).toContain("@3xl:grid-cols-[minmax(0,1fr)_340px]");
    expect(page).toContain("@3xl:sticky");
    expect(page).toContain('id="product-buy"');
    expect(page).toContain('href="/@maya/ui-course/checkout"');
    expect(page).toContain("3 lessons in 2 modules");
    expect(page).toContain("Course content");
    expect(page).toContain('href="/@maya"');
    expect(page.match(/<h1/g)).toHaveLength(1);
  });

  it("adds the phone buy bar only when the product can be bought", () => {
    expect(render(course, true)).toContain('data-slot="mobile-buy-bar"');
    const closed = render(course, false);
    expect(closed).not.toContain('data-slot="mobile-buy-bar"');
    expect(closed).not.toContain("/checkout");
    expect(closed).toContain("Payments aren&#x27;t set up");
  });

  it("describes a digital product's delivery and falls back to Buy now", () => {
    const page = render(ebook, true);
    expect(page).toContain("Delivered by email right after payment");
    expect(page).toContain("Buy now");
    expect(page).not.toContain("Course content");
  });
});
