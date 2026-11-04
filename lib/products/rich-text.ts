import { z } from "zod";

import { cleanText } from "@/lib/products/text";

// Product descriptions as structured rich text (D-049). The editor (Tiptap) produces a ProseMirror
// JSON document; we keep only an allow-list of nodes and marks, check every link, and render it
// ourselves (components/store/rich-text.tsx). No HTML is ever stored or rendered (CLAUDE.md 5, D-014).

/** Most characters of text a description may hold (the same limit as the old plain description). */
export const RICH_TEXT_MAX_CHARS = 2000;
/** Upper bounds on the shape, so a hand-made payload cannot be huge or deeply nested. */
const MAX_NODES = 600;
const MAX_DEPTH = 6;
const LINK_MAX = 500;

export type RichMark = { type: "bold" } | { type: "italic" } | { type: "underline" } | { type: "link"; attrs: { href: string } };
export type RichText = { type: "text"; text: string; marks?: RichMark[] };
export type RichInline = RichText | { type: "hardBreak" };
export type RichParagraph = { type: "paragraph"; content?: RichInline[] };
export type RichHeading = { type: "heading"; attrs: { level: 2 | 3 }; content?: RichInline[] };
export type RichListItem = { type: "listItem"; content: RichBlock[] };
export type RichList = { type: "bulletList" | "orderedList"; content: RichListItem[] };
export type RichBlock = RichParagraph | RichHeading | RichList;
export type RichDoc = { type: "doc"; content: RichBlock[] };

/** Links in a description: https or mailto only, no credentials (D-014). */
export function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (value.length > LINK_MAX) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "mailto:") return value;
    if (url.protocol === "https:" && url.hostname.includes(".") && !url.username && !url.password) return url.toString();
    return null;
  } catch {
    return null;
  }
}

const markSchema: z.ZodType<RichMark> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }).strip(),
  z.object({ type: z.literal("italic") }).strip(),
  z.object({ type: z.literal("underline") }).strip(),
  z
    .object({
      type: z.literal("link"),
      attrs: z.object({ href: z.string().max(LINK_MAX) }).loose(),
    })
    .transform((mark, ctx) => {
      const href = safeHref(mark.attrs.href);
      if (!href) {
        ctx.addIssue({ code: "custom", message: "Links must start with https://" });
        return z.NEVER;
      }
      // Only the address is kept; target, rel and classes are always set by our renderer.
      return { type: "link" as const, attrs: { href } };
    }),
]);

const textSchema = z
  .object({
    type: z.literal("text"),
    // Tags and control characters are removed, like every other creator text.
    text: z.string().max(RICH_TEXT_MAX_CHARS).transform((value) => cleanText(value, { multiline: false, trim: false })),
    marks: z.array(markSchema).max(4).optional(),
  })
  .strip();

const inlineSchema: z.ZodType<RichInline> = z.union([textSchema, z.object({ type: z.literal("hardBreak") }).strip()]);

const blockSchema: z.ZodType<RichBlock> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal("paragraph"), content: z.array(inlineSchema).optional() }).strip(),
    z
      .object({
        type: z.literal("heading"),
        attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }).strip(),
        content: z.array(inlineSchema).optional(),
      })
      .strip(),
    z
      .object({
        type: z.enum(["bulletList", "orderedList"]),
        content: z.array(z.object({ type: z.literal("listItem"), content: z.array(blockSchema).min(1) }).strip()).min(1),
      })
      .strip(),
  ]),
);

function countNodes(node: unknown, depth = 0): { nodes: number; depth: number } {
  if (!node || typeof node !== "object") return { nodes: 0, depth };
  const children = (node as { content?: unknown }).content;
  let total = { nodes: 1, depth };
  if (Array.isArray(children)) {
    for (const child of children) {
      const inner = countNodes(child, depth + 1);
      total = { nodes: total.nodes + inner.nodes, depth: Math.max(total.depth, inner.depth) };
    }
  }
  return total;
}

/**
 * A rich text document as the editor sends it, at most `maxChars` characters of text and
 * `maxNodes` nodes. Unknown node or mark types fail the check (they are never silently passed
 * through); the size and depth are capped before the shape is parsed. Each text run stays within
 * RICH_TEXT_MAX_CHARS.
 */
export function richDocSchemaWith(options: { maxChars: number; maxNodes: number; label: string }) {
  return z
    .unknown()
    .superRefine((value, ctx) => {
      const { nodes, depth } = countNodes(value);
      if (nodes > options.maxNodes || depth > MAX_DEPTH) ctx.addIssue({ code: "custom", message: `The ${options.label.toLowerCase()} is too long or too nested.` });
    })
    .pipe(z.object({ type: z.literal("doc"), content: z.array(blockSchema) }).strip())
    .transform(trimDoc)
    .refine((doc) => plainTextOf(doc).length <= options.maxChars, {
      error: `${options.label}: use ${options.maxChars} characters or fewer.`,
    });
}

/** A product or course description (D-049). */
export const richDocSchema = richDocSchemaWith({ maxChars: RICH_TEXT_MAX_CHARS, maxNodes: MAX_NODES, label: "Description" });

function inlineText(content: RichInline[] | undefined): string {
  return (content ?? []).map((node) => (node.type === "text" ? node.text : "\n")).join("");
}

function blockText(block: RichBlock): string {
  if (block.type === "paragraph" || block.type === "heading") return inlineText(block.content);
  return block.content.map((item) => item.content.map(blockText).join("\n")).join("\n");
}

/** The description as plain text: for line-clamped cards, search, page meta and length limits. */
export function plainTextOf(doc: RichDoc): string {
  return doc.content.map(blockText).join("\n").trim();
}

const isBlankParagraph = (block: RichBlock) => block.type === "paragraph" && inlineText(block.content).trim() === "";

/** Drops empty paragraphs at the start and end (the editor keeps one at the end while typing). */
export function trimDoc(doc: RichDoc): RichDoc {
  const content = [...doc.content];
  while (content.length > 0 && isBlankParagraph(content[0] as RichBlock)) content.shift();
  while (content.length > 0 && isBlankParagraph(content[content.length - 1] as RichBlock)) content.pop();
  return { type: "doc", content };
}

/** True when a document holds no visible text. */
export function isEmptyDoc(doc: RichDoc | null | undefined): boolean {
  return !doc || plainTextOf(doc) === "";
}

/** A plain-text description from before D-049 as a document: one paragraph per line. */
export function docFromPlainText(text: string | null | undefined): RichDoc {
  const lines = (text ?? "").split("\n");
  return {
    type: "doc",
    content: lines.map((line) => (line.trim() === "" ? { type: "paragraph" } : { type: "paragraph", content: [{ type: "text", text: line }] })),
  };
}
