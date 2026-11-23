import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// D-125 fix: on Store design the preview scrolls inside its box, so changes lower on the page
// (product cards, buttons) can be seen; elsewhere it stays cut at its height.

vi.mock("server-only", () => ({}));
vi.mock("@/components/store/fonts", () => {
  const font = (name: string) => ({ className: `font-${name}-var`, cssVar: `var(--font-store-${name})` });
  return { storeSerif: { variable: "font-store-serif-var" }, STORE_FONTS: { sans: { className: "", cssVar: null }, serif: font("serif"), playfair: font("playfair"), grotesk: font("grotesk"), poppins: font("poppins"), mono: font("mono") } };
});
vi.mock("@/components/brand/wordmark", () => ({ Wordmark: () => null }));

import { LiveStorePreview } from "@/components/dashboard/live-store-preview";
import type { PublicStore } from "@/lib/stores/public";

const store: PublicStore = { id: "s1", slug: "maya", name: "Maya", bio: null, avatarUrl: null, socialLinks: [], theme: { preset: "clean", accent: "#0056FF" }, currency: "usd", isOpen: true, pixels: null, pageBlocks: [] };

describe("live store preview", () => {
  it("scrolls inside its box when asked, with a CSS max height", () => {
    const html = renderToStaticMarkup(createElement(LiveStorePreview, { store, products: [], maxHeight: "calc(100dvh - 16rem)", scroll: true }));
    expect(html).toContain("overflow-y-auto");
    expect(html).toContain("calc(100dvh - 16rem)");
  });

  it("is cut at its height otherwise", () => {
    const html = renderToStaticMarkup(createElement(LiveStorePreview, { store, products: [], maxHeight: 560 }));
    expect(html).toContain("overflow-hidden");
    expect(html).not.toContain("overflow-y-auto");
  });
});
