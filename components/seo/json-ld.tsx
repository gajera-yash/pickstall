import { jsonLdText } from "@/lib/seo/schema";

/**
 * Structured data for search and answer engines (D-134, D-135). The data is built by our own code:
 * fixed site facts, or a creator's public store and product fields cleaned and length-limited by
 * `lib/seo/store-schema.ts` (never buyer data). `jsonLdText` escapes <, > and & so it cannot end the tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  // JSON from our own builders, escaped by jsonLdText (no "</script>" can appear), so
  // dangerouslySetInnerHTML is safe here: it is a JSON data block, never rendered as HTML.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />;
}
