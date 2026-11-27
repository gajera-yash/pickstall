import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ stores: { findOne: vi.fn(), updateOne: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/components/store/fonts", () => { const font = (name: string) => ({ className: `font-${name}-var`, cssVar: `var(--font-store-${name})` }); return { storeSerif: { variable: "font-store-serif-var" }, STORE_FONTS: { sans: { className: "", cssVar: null }, serif: font("serif"), playfair: font("playfair"), grotesk: font("grotesk"), poppins: font("poppins"), mono: font("mono") } }; });
vi.mock("@/components/brand/wordmark", () => ({ Wordmark: () => null }));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));

import { StoreBlocks } from "@/components/store/store-blocks";
import { resolveTheme } from "@/components/store/store-theme";
import { findPageBlocks, savePageBlocks } from "@/lib/page-blocks/queries";
import { BLOCK_LIMITS, PAGE_BLOCKS_MAX, imagesOf, pageBlocksInput, splitBlocks, videosOf, type PageBlock } from "@/lib/page-blocks/rules";

const products = { id: "products1", type: "products" as const };

describe("page section rules (D-101)", () => {
  it("cleans text, keeps https links only and turns a video link into a checked id", () => {
    const parsed = pageBlocksInput.parse([
      { id: "text0001", type: "text", heading: "<b>Hi</b>", body: "Welcome <script>x</script>\nhttps://example.com" },
      products,
      { id: "video001", type: "video", link: "https://youtu.be/dQw4w9WgXcQ" },
      { id: "links001", type: "links", links: [{ label: "Join", url: "https://chat.whatsapp.com/abc" }] },
      { id: "quote001", type: "testimonial", quote: "Loved it", name: "" },
    ]);
    expect(parsed).toEqual([
      { id: "text0001", type: "text", heading: "Hi", body: "Welcome x\nhttps://example.com" },
      products,
      { id: "video001", type: "video", videos: [{ kind: "youtube", id: "dQw4w9WgXcQ" }] },
      { id: "links001", type: "links", links: [{ label: "Join", url: "https://chat.whatsapp.com/abc" }] },
      { id: "quote001", type: "testimonial", quote: "Loved it", name: null },
    ]);
  });

  it("refuses unsafe links, other video hosts, javascript images and empty sections", () => {
    const bad = [
      { id: "links001", type: "links", links: [{ label: "x", url: "javascript:alert(1)" }] },
      { id: "links002", type: "links", links: [{ label: "x", url: "http://example.com" }] },
      { id: "video001", type: "video", link: "https://evil.example/watch?v=dQw4w9WgXcQ" },
      { id: "image001", type: "image", url: "javascript:alert(1)", alt: "" },
      { id: "text0001", type: "text", heading: "", body: "   " },
    ];
    for (const block of bad) expect(pageBlocksInput.safeParse([products, block]).success).toBe(false);
  });

  it("keeps several images with their grid and several videos with their layout", () => {
    const image = "/media/0b8f4b52-8d6c-4f6d-9d0e-3c3d6f1b2a10";
    const parsed = pageBlocksInput.parse([
      products,
      { id: "image001", type: "image", images: [{ url: image, alt: "<b>One</b>" }, { url: image, alt: "" }], grid: { columns: 3, ratio: "square", gap: "small" } },
      { id: "image002", type: "image", url: image, alt: "Old shape" },
      { id: "video001", type: "video", links: ["https://youtu.be/dQw4w9WgXcQ", "https://vimeo.com/76979871"], columns: 2 },
    ]);
    expect(parsed.slice(1)).toEqual([
      { id: "image001", type: "image", images: [{ url: image, alt: "One" }, { url: image, alt: "" }], grid: { columns: 3, ratio: "square", gap: "small" } },
      { id: "image002", type: "image", images: [{ url: image, alt: "Old shape" }] },
      { id: "video001", type: "video", videos: [{ kind: "youtube", id: "dQw4w9WgXcQ" }, { kind: "vimeo", id: "76979871", hash: null }], columns: 2 },
    ]);
  });

  it("refuses a bad image or video among many, too many items and unknown grid options", () => {
    const image = "/media/0b8f4b52-8d6c-4f6d-9d0e-3c3d6f1b2a10";
    const bad = [
      { id: "image001", type: "image", images: [{ url: image, alt: "" }, { url: "javascript:alert(1)", alt: "" }] },
      { id: "image002", type: "image", images: [] },
      { id: "image003", type: "image", images: Array.from({ length: BLOCK_LIMITS.imagesMax + 1 }, () => ({ url: image, alt: "" })) },
      { id: "image004", type: "image", images: [{ url: image, alt: "" }], grid: { columns: 7, ratio: "square", gap: "small" } },
      { id: "video001", type: "video", links: ["https://youtu.be/dQw4w9WgXcQ", "https://evil.example/x"] },
      { id: "video002", type: "video", links: Array.from({ length: BLOCK_LIMITS.videosMax + 1 }, () => "https://youtu.be/dQw4w9WgXcQ") },
    ];
    for (const block of bad) expect(pageBlocksInput.safeParse([products, block]).success).toBe(false);
  });

  it("keeps a cleaned section title, drops an empty one and refuses a long one", () => {
    const parsed = pageBlocksInput.parse([
      products,
      { id: "video001", type: "video", title: " <b>Watch</b> ", links: ["https://youtu.be/dQw4w9WgXcQ"] },
      { id: "quote001", type: "testimonial", title: "", quote: "Loved it", name: "" },
    ]);
    expect(parsed.slice(1)).toEqual([
      { id: "video001", type: "video", title: "Watch", videos: [{ kind: "youtube", id: "dQw4w9WgXcQ" }] },
      { id: "quote001", type: "testimonial", quote: "Loved it", name: null },
    ]);
    const long = { id: "quote001", type: "testimonial", title: "x".repeat(BLOCK_LIMITS.title + 1), quote: "Loved it", name: "" };
    expect(pageBlocksInput.safeParse([products, long]).success).toBe(false);
    const html = renderToStaticMarkup(createElement(StoreBlocks, { theme: resolveTheme({ preset: "clean", accent: "#0056FF" }), blocks: [{ id: "quote001", type: "testimonial", title: "<i>Students</i>", quote: "Loved it", name: null }] }));
    expect(html).toContain("&lt;i&gt;Students&lt;/i&gt;</h2>");
  });

  it("reads sections saved before multi-image and multi-video sections", () => {
    expect(imagesOf({ id: "image001", type: "image", url: "/media/x", alt: "a" })).toEqual([{ url: "/media/x", alt: "a" }]);
    expect(videosOf({ id: "video001", type: "video", video: { kind: "youtube", id: "dQw4w9WgXcQ" } })).toEqual([{ kind: "youtube", id: "dQw4w9WgXcQ" }]);
  });

  it("always keeps exactly one Products section and at most 12 others", () => {
    expect(pageBlocksInput.safeParse([{ id: "text0001", type: "text", heading: "", body: "x" }]).success).toBe(false);
    expect(pageBlocksInput.safeParse([products, { id: "products2", type: "products" }]).success).toBe(false);
    const many = Array.from({ length: PAGE_BLOCKS_MAX + 1 }, (_, i) => ({ id: `text${String(i).padStart(4, "0")}`, type: "text", heading: "", body: "x" }));
    expect(pageBlocksInput.safeParse([products, ...many]).success).toBe(false);
    expect(pageBlocksInput.safeParse([products, ...many.slice(0, PAGE_BLOCKS_MAX)]).success).toBe(true);
  });

  it("splits sections around the products; no sections keep the page as before", () => {
    const text: PageBlock = { id: "text0001", type: "text", heading: null, body: "x" };
    expect(splitBlocks([text, products, text])).toEqual({ before: [text], after: [text] });
    expect(splitBlocks([])).toEqual({ before: [], after: [] });
    expect(splitBlocks(undefined)).toEqual({ before: [], after: [] });
  });
});

describe("rendering sections (D-101)", () => {
  it("escapes creator text, links https only and embeds only from the checked id", () => {
    const html = renderToStaticMarkup(
      createElement(StoreBlocks, {
        theme: resolveTheme({ preset: "clean", accent: "#0056FF" }),
        blocks: [
          { id: "text0001", type: "text", heading: "<img src=x>", body: "See https://example.com/a now" },
          { id: "video001", type: "video", video: { kind: "youtube", id: "dQw4w9WgXcQ" } },
          { id: "links001", type: "links", links: [{ label: "Join", url: "https://chat.example.com" }] },
        ],
      }),
    );
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;img src=x&gt;");
    expect(html).toContain('href="https://example.com/a"');
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0"');
    expect(html).toContain('rel="noopener noreferrer nofollow ugc"');
  });

  it("renders nothing without sections", () => {
    expect(renderToStaticMarkup(createElement(StoreBlocks, { theme: resolveTheme({ preset: "clean", accent: "#0056FF" }), blocks: [] }))).toBe("");
  });
});

describe("page sections are saved for the session's store only (CLAUDE.md 6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads and writes the given store", async () => {
    db.stores.findOne.mockResolvedValue(null);
    expect(await findPageBlocks("store-b")).toEqual([]);
    expect(db.stores.findOne).toHaveBeenCalledWith({ _id: "store-b" }, expect.anything());
    await savePageBlocks("store-b", [products]);
    expect(db.stores.updateOne).toHaveBeenCalledWith({ _id: "store-b" }, { $set: expect.objectContaining({ pageBlocks: [products] }) });
  });
});
