import { z } from "zod";

import { parseMoneyToCents, priceProblem } from "@/lib/products/money";
import { PRODUCT_LIMITS } from "@/lib/products/schemas";
import { cleanText } from "@/lib/products/text";

// Product import (PRD 9: "import (Gumroad API, Stan CSV)"). Pure rules: what an imported product
// looks like, how Gumroad's product JSON and CSV rows become one, and the limits. Imported products
// are always drafts without delivery (files cannot be copied): the creator adds the file or link
// and publishes.

export const IMPORT_PRODUCTS_MAX = 100;

/** One product ready to import (cleaned and length-limited creator text, our integer price or null). */
export type ImportCandidate = {
  source: "gumroad" | "csv";
  /** Gumroad's product id, or a hash of the CSV title, so importing again skips what is already in. */
  externalId: string;
  title: string;
  description: string | null;
  /** In the store's currency units; null when the source used another currency or had no valid price. */
  priceCents: number | null;
  /** Why the price was left out, for the preview ("Price was in EUR"). */
  priceNote: string | null;
  /** A public https image to copy as the cover (Gumroad thumbnails only), or null. */
  coverSourceUrl: string | null;
  /** True when the source product was published (shown in the preview only; imports are drafts). */
  wasPublished: boolean;
  /** Products we cannot recreate (memberships): shown, not importable. */
  skipReason: string | null;
};

/** Plain text from Gumroad's description, which may be HTML: tags dropped, entities decoded, paragraphs kept. */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

const titleOf = (raw: string) => clip(cleanText(raw), PRODUCT_LIMITS.title);
const descriptionOf = (raw: string | null | undefined) => {
  if (!raw) return null;
  const text = clip(cleanText(htmlToText(raw), { multiline: true }), PRODUCT_LIMITS.description);
  return text || null;
};

/** Only Gumroad's own public image hosts are copied (no fetching arbitrary URLs from imported data). */
export function isGumroadImage(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && /(^|\.)gumroad\.com$/.test(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

/** Gumroad's product (GET /v2/products), only the fields we use. Checked against gumroad.com/api on 2026-11-21. */
export const gumroadProduct = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().max(1000),
    description: z.string().max(200_000).nullable().optional(),
    price: z.number().int().nonnegative().nullable().optional(),
    currency: z.string().min(3).max(3).nullable().optional(),
    thumbnail_url: z.string().nullable().optional(),
    published: z.boolean().optional(),
    deleted: z.boolean().optional(),
    is_tiered_membership: z.boolean().nullable().optional(),
  })
  .loose();
export const gumroadProducts = z.object({ success: z.literal(true), products: z.array(gumroadProduct) }).loose();

/** A Gumroad product as an import candidate for a store selling in `storeCurrency`. Null for deleted ones. */
export function fromGumroad(product: z.infer<typeof gumroadProduct>, storeCurrency: string): ImportCandidate | null {
  if (product.deleted) return null;
  const title = titleOf(product.name);
  if (!title) return null;
  const currency = (product.currency ?? "").toLowerCase();
  const sameCurrency = currency === storeCurrency.toLowerCase();
  // Gumroad prices are in the currency's smallest unit, like ours (cents, or whole yen).
  const price = sameCurrency && typeof product.price === "number" ? product.price : null;
  const valid = price !== null && (price === 0 || priceProblem(price, storeCurrency, "Price") === null);
  return {
    source: "gumroad",
    externalId: product.id,
    title,
    description: descriptionOf(product.description),
    priceCents: valid ? price : null,
    priceNote: !sameCurrency && currency ? `Price was in ${currency.toUpperCase()}: set it again in ${storeCurrency.toUpperCase()}.` : !valid && price !== null ? "Price is outside the allowed range: set it again." : null,
    coverSourceUrl: isGumroadImage(product.thumbnail_url) ? product.thumbnail_url : null,
    wasPublished: product.published === true,
    skipReason: product.is_tiered_membership ? "Memberships can't be imported yet." : null,
  };
}

/** A stable key for a CSV title (FNV-1a, 2 x 32 bits): the same title imported again is skipped. Pure, client-safe. */
export function titleKey(title: string): string {
  const text = title.trim().toLowerCase();
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b ^ text.charCodeAt(text.length - 1 - i), 0x01000193) >>> 0;
  }
  return `csv-${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
}

/** The columns a product CSV can map (Stan has no export: creators fill our template or their own sheet). */
export type CsvMapping = { title: number; price: number; description: number };

export function guessProductColumn(header: string[], kind: keyof CsvMapping): number {
  const names: Record<keyof CsvMapping, RegExp> = {
    title: /^(title|name|product|product name|product title)$/i,
    price: /^(price|amount|cost)$/i,
    description: /^(description|details|about|summary)$/i,
  };
  return header.findIndex((cell) => names[kind].test(cell.trim()));
}

/** A CSV row as an import candidate, or a reason it is skipped. Prices are read in the store's currency. */
export function fromCsvRow(row: string[], mapping: CsvMapping, storeCurrency: string): ImportCandidate | { error: string } {
  const title = titleOf(row[mapping.title] ?? "");
  if (!title) return { error: "No title" };
  const rawPrice = mapping.price >= 0 ? (row[mapping.price] ?? "").trim() : "";
  const price = rawPrice ? parseMoneyToCents(rawPrice, storeCurrency) : 0;
  const valid = price !== null && (price === 0 || priceProblem(price, storeCurrency, "Price") === null);
  return {
    source: "csv",
    externalId: titleKey(title),
    title,
    description: mapping.description >= 0 ? descriptionOf(row[mapping.description]) : null,
    priceCents: valid ? price : null,
    priceNote: valid ? null : `"${clip(rawPrice, 20)}" is not a price: set it again.`,
    coverSourceUrl: null,
    wasPublished: false,
    skipReason: null,
  };
}

/** What the import page sends back for CSV rows: only the mapped cells, checked again on the server. */
export const csvImportInput = z.object({
  rows: z.array(z.object({ title: z.string().max(2000), price: z.string().max(40), description: z.string().max(20_000) })).min(1).max(IMPORT_PRODUCTS_MAX),
});
