import { z } from "zod";

import { parseVideoLink, type LinkedVideo } from "@/lib/courses/video-links";
import { cleanText } from "@/lib/products/text";
import { httpsUrlSchema, imageField } from "@/lib/stores/schemas";

// Store page sections (D-101). Pure and client-safe: the editor, the server and the store page use
// the same rules. Every text is cleaned of tags and length-limited; links are https; a video is
// kept only as a checked YouTube or Vimeo id; an image is an upload (/media/...) or https.

export const PAGE_BLOCKS_MAX = 12;
export const BLOCK_LIMITS = { heading: 80, body: 2000, alt: 120, linkLabel: 40, linksMax: 6, quote: 400, name: 60, title: 60, imagesMax: 12, videosMax: 6 } as const;

/**
 * How an Image section lays out its pictures (several images per section): columns on wide screens
 * (phones show at most two), the picture shape and the gap. Missing: one column, original shape,
 * normal gap (a single image as before).
 */
export const IMAGE_COLUMNS = [1, 2, 3, 4] as const;
export const IMAGE_RATIOS = ["original", "square", "landscape", "portrait"] as const;
export const IMAGE_GAPS = ["small", "normal", "large"] as const;
export type ImageGrid = { columns: (typeof IMAGE_COLUMNS)[number]; ratio: (typeof IMAGE_RATIOS)[number]; gap: (typeof IMAGE_GAPS)[number] };
export const DEFAULT_IMAGE_GRID: ImageGrid = { columns: 1, ratio: "original", gap: "normal" };
/** Videos in one section: one per row or two side by side on wide screens. */
export const VIDEO_COLUMNS = [1, 2] as const;
export type VideoColumns = (typeof VIDEO_COLUMNS)[number];
export type BlockImage = { url: string; alt: string };

/**
 * How one section looks (D-123): its box (the theme's card, an outline, or none), text alignment and
 * the space around it. Missing: the card, left-aligned, normal spacing (the look before D-123).
 */
export const SECTION_BOXES = ["card", "outline", "none"] as const;
export const SECTION_ALIGNS = ["left", "center"] as const;
export const SECTION_SPACINGS = ["compact", "normal", "roomy"] as const;
export type SectionStyle = { box: (typeof SECTION_BOXES)[number]; align: (typeof SECTION_ALIGNS)[number]; spacing: (typeof SECTION_SPACINGS)[number] };
export const DEFAULT_SECTION_STYLE: SectionStyle = { box: "card", align: "left", spacing: "normal" };

/** `title`: the heading above a section, drawn like the store's "Shop" heading. */
type Styled = { style?: SectionStyle; title?: string };
/** Sections that take a title (Text has its own Heading). */
export const TITLED_BLOCKS: PageBlockType[] = ["image", "video", "links", "testimonial"];
export type PageBlock =
  | { id: string; type: "products" }
  | ({ id: string; type: "text"; heading: string | null; body: string } & Styled)
  // `url`/`alt` and `video` are the one-item shapes saved before multi-image and multi-video
  // sections; read them through imagesOf() and videosOf(). New saves write `images` / `videos`.
  | ({ id: string; type: "image"; images?: BlockImage[]; grid?: ImageGrid; url?: string; alt?: string } & Styled)
  | ({ id: string; type: "video"; videos?: LinkedVideo[]; columns?: VideoColumns; video?: LinkedVideo } & Styled)
  | ({ id: string; type: "links"; links: { label: string; url: string }[] } & Styled)
  | ({ id: string; type: "testimonial"; quote: string; name: string | null } & Styled);

export type PageBlockType = PageBlock["type"];
export const ADDABLE_BLOCKS: Exclude<PageBlockType, "products">[] = ["text", "image", "video", "links", "testimonial"];
export const BLOCK_LABELS: Record<PageBlockType, string> = { products: "Products", text: "Text", image: "Image", video: "Video", links: "Links", testimonial: "Testimonial" };

const id = z.string().regex(/^[A-Za-z0-9_-]{6,40}$/);
const text = (max: number, label: string, options: { multiline?: boolean; required?: boolean } = {}) =>
  z
    .string()
    .transform((value) => cleanText(value, { multiline: options.multiline }))
    .pipe(z.string().max(max, { error: `${label}: use ${max} characters or fewer.` }))
    .refine((value) => !options.required || value !== "", { error: `${label}: write something or remove this section.` });

const imageItem = z.object({
  url: imageField("Image").refine((value) => value !== undefined, { error: "Image: upload an image or remove it." }),
  alt: text(BLOCK_LIMITS.alt, "Image description"),
});
const imageGrid = z.object({ columns: z.literal(IMAGE_COLUMNS), ratio: z.enum(IMAGE_RATIOS), gap: z.enum(IMAGE_GAPS) }).optional();

const title = text(BLOCK_LIMITS.title, "Section title").optional();

const style = z.object({ box: z.enum(SECTION_BOXES), align: z.enum(SECTION_ALIGNS), spacing: z.enum(SECTION_SPACINGS) }).optional();

/** One section as the editor sends it. A video arrives as the pasted link and is parsed here. */
const blockInput = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("products") }),
  z.object({ id, style, type: z.literal("text"), heading: text(BLOCK_LIMITS.heading, "Heading"), body: text(BLOCK_LIMITS.body, "Text", { multiline: true, required: true }) }),
  z.object({
    id,
    style,
    title,
    grid: imageGrid,
    type: z.literal("image"),
    images: z.array(imageItem).min(1, { error: "Image: upload an image or remove this section." }).max(BLOCK_LIMITS.imagesMax, { error: `Use up to ${BLOCK_LIMITS.imagesMax} images in one section.` }),
  }),
  z.object({
    id,
    style,
    title,
    columns: z.literal(VIDEO_COLUMNS).optional(),
    type: z.literal("video"),
    links: z.array(z.string().max(500)).min(1, { error: "Video: paste a YouTube or Vimeo link." }).max(BLOCK_LIMITS.videosMax, { error: `Use up to ${BLOCK_LIMITS.videosMax} videos in one section.` }),
  }),
  z.object({
    id,
    style,
    title,
    type: z.literal("links"),
    links: z
      .array(z.object({ label: text(BLOCK_LIMITS.linkLabel, "Button text", { required: true }), url: httpsUrlSchema("link").refine((value) => value !== undefined, { error: "Enter a full link that starts with https://" }) }))
      .min(1, { error: "Add at least one link or remove this section." })
      .max(BLOCK_LIMITS.linksMax, { error: `Use up to ${BLOCK_LIMITS.linksMax} links.` }),
  }),
  z.object({ id, style, title, type: z.literal("testimonial"), quote: text(BLOCK_LIMITS.quote, "Quote", { multiline: true, required: true }), name: text(BLOCK_LIMITS.name, "Name") }),
]);

/** A one-image (`url`/`alt`) or one-video (`link`) section from older editors, as the list shapes. */
function upgradeOldShape(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const block = value as Record<string, unknown>;
  if (block.type === "image" && !("images" in block) && "url" in block) {
    const { url, alt, ...rest } = block;
    return { ...rest, images: [{ url, alt: alt ?? "" }] };
  }
  if (block.type === "video" && !("links" in block) && "link" in block) {
    const { link, ...rest } = block;
    return { ...rest, links: [link] };
  }
  return value;
}

/** The whole list from the editor: at most 12 sections, unique ids, exactly one Products section. */
export const pageBlocksInput = z
  .array(z.preprocess(upgradeOldShape, blockInput))
  .max(PAGE_BLOCKS_MAX + 1, { error: `Use up to ${PAGE_BLOCKS_MAX} sections.` })
  .transform((blocks, ctx): PageBlock[] => {
    const out: PageBlock[] = [];
    const seen = new Set<string>();
    blocks.forEach((block, index) => {
      if (seen.has(block.id)) return;
      seen.add(block.id);
      // Only a style that differs from the default is saved.
      const styled = block.type !== "products" && block.style && (block.style.box !== "card" || block.style.align !== "left" || block.style.spacing !== "normal") ? { style: block.style } : {};
      // An empty title is not saved.
      const look = "title" in block && block.title ? { ...styled, title: block.title } : styled;
      if (block.type === "video") {
        const videos: LinkedVideo[] = [];
        for (const [i, link] of block.links.entries()) {
          const video = parseVideoLink(link);
          if (!video) {
            ctx.addIssue({ code: "custom", path: [index, "links", i], message: block.links.length > 1 ? `Video ${i + 1}: paste a YouTube or Vimeo link.` : "Video: paste a YouTube or Vimeo link." });
            return;
          }
          videos.push(video);
        }
        const columns = block.columns === 2 && videos.length > 1 ? { columns: 2 as const } : {};
        out.push({ id: block.id, type: "video", videos, ...columns, ...look });
      } else if (block.type === "text") out.push({ id: block.id, type: "text", heading: block.heading || null, body: block.body, ...look });
      else if (block.type === "image") {
        const grid = block.grid && (block.grid.columns !== 1 || block.grid.ratio !== "original" || block.grid.gap !== "normal") ? { grid: block.grid } : {};
        out.push({ id: block.id, type: "image", images: block.images.map((image) => ({ url: image.url as string, alt: image.alt })), ...grid, ...look });
      }
      else if (block.type === "links") out.push({ id: block.id, type: "links", links: block.links.map((link) => ({ label: link.label, url: link.url as string })), ...look });
      else if (block.type === "testimonial") out.push({ id: block.id, type: "testimonial", quote: block.quote, name: block.name || null, ...look });
      else out.push({ id: block.id, type: "products" });
    });
    const products = out.filter((block) => block.type === "products").length;
    if (products !== 1) ctx.addIssue({ code: "custom", path: [], message: "Keep the Products section on your page." });
    if (out.length - products > PAGE_BLOCKS_MAX) ctx.addIssue({ code: "custom", path: [], message: `Use up to ${PAGE_BLOCKS_MAX} sections.` });
    return out;
  });

/** The sections above and below the products, from saved blocks (none saved: the page as before). */
export function splitBlocks(blocks: PageBlock[] | null | undefined): { before: PageBlock[]; after: PageBlock[] } {
  if (!blocks || blocks.length === 0) return { before: [], after: [] };
  const at = blocks.findIndex((block) => block.type === "products");
  if (at === -1) return { before: [], after: blocks };
  return { before: blocks.slice(0, at), after: blocks.slice(at + 1) };
}

/** A fresh id for a new section (browser or server). */
export function newBlockId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

type ImageBlock = Extract<PageBlock, { type: "image" }>;
type VideoBlock = Extract<PageBlock, { type: "video" }>;

/** The pictures of an Image section, new or saved before multi-image sections. */
export function imagesOf(block: ImageBlock): BlockImage[] {
  if (block.images && block.images.length > 0) return block.images;
  return block.url ? [{ url: block.url, alt: block.alt ?? "" }] : [];
}

/** The videos of a Video section, new or saved before multi-video sections. */
export function videosOf(block: VideoBlock): LinkedVideo[] {
  if (block.videos && block.videos.length > 0) return block.videos;
  return block.video ? [block.video] : [];
}
