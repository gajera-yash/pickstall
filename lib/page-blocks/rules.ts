import { z } from "zod";

import { parseVideoLink, type LinkedVideo } from "@/lib/courses/video-links";
import { cleanText } from "@/lib/products/text";
import { httpsUrlSchema, imageField } from "@/lib/stores/schemas";

// Store page sections (D-101). Pure and client-safe: the editor, the server and the store page use
// the same rules. Every text is cleaned of tags and length-limited; links are https; a video is
// kept only as a checked YouTube or Vimeo id; an image is an upload (/media/...) or https.

export const PAGE_BLOCKS_MAX = 12;
export const BLOCK_LIMITS = { heading: 80, body: 2000, alt: 120, linkLabel: 40, linksMax: 6, quote: 400, name: 60 } as const;

export type PageBlock =
  | { id: string; type: "products" }
  | { id: string; type: "text"; heading: string | null; body: string }
  | { id: string; type: "image"; url: string; alt: string }
  | { id: string; type: "video"; video: LinkedVideo }
  | { id: string; type: "links"; links: { label: string; url: string }[] }
  | { id: string; type: "testimonial"; quote: string; name: string | null };

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

/** One section as the editor sends it. A video arrives as the pasted link and is parsed here. */
const blockInput = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("products") }),
  z.object({ id, type: z.literal("text"), heading: text(BLOCK_LIMITS.heading, "Heading"), body: text(BLOCK_LIMITS.body, "Text", { multiline: true, required: true }) }),
  z.object({
    id,
    type: z.literal("image"),
    url: imageField("Image").refine((value) => value !== undefined, { error: "Image: upload an image or remove this section." }),
    alt: text(BLOCK_LIMITS.alt, "Image description"),
  }),
  z.object({ id, type: z.literal("video"), link: z.string().max(500) }),
  z.object({
    id,
    type: z.literal("links"),
    links: z
      .array(z.object({ label: text(BLOCK_LIMITS.linkLabel, "Button text", { required: true }), url: httpsUrlSchema("link").refine((value) => value !== undefined, { error: "Enter a full link that starts with https://" }) }))
      .min(1, { error: "Add at least one link or remove this section." })
      .max(BLOCK_LIMITS.linksMax, { error: `Use up to ${BLOCK_LIMITS.linksMax} links.` }),
  }),
  z.object({ id, type: z.literal("testimonial"), quote: text(BLOCK_LIMITS.quote, "Quote", { multiline: true, required: true }), name: text(BLOCK_LIMITS.name, "Name") }),
]);

/** The whole list from the editor: at most 12 sections, unique ids, exactly one Products section. */
export const pageBlocksInput = z
  .array(blockInput)
  .max(PAGE_BLOCKS_MAX + 1, { error: `Use up to ${PAGE_BLOCKS_MAX} sections.` })
  .transform((blocks, ctx): PageBlock[] => {
    const out: PageBlock[] = [];
    const seen = new Set<string>();
    blocks.forEach((block, index) => {
      if (seen.has(block.id)) return;
      seen.add(block.id);
      if (block.type === "video") {
        const video = parseVideoLink(block.link);
        if (!video) {
          ctx.addIssue({ code: "custom", path: [index, "link"], message: "Video: paste a YouTube or Vimeo link." });
          return;
        }
        out.push({ id: block.id, type: "video", video });
      } else if (block.type === "text") out.push({ id: block.id, type: "text", heading: block.heading || null, body: block.body });
      else if (block.type === "image") out.push({ id: block.id, type: "image", url: block.url as string, alt: block.alt });
      else if (block.type === "links") out.push({ id: block.id, type: "links", links: block.links.map((link) => ({ label: link.label, url: link.url as string })) });
      else if (block.type === "testimonial") out.push({ id: block.id, type: "testimonial", quote: block.quote, name: block.name || null });
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
