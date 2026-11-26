import { jsonLdText } from "@/lib/seo/schema";

/**
 * Structured data for search and answer engines (D-134). The data is built by our own code from fixed
 * site facts (never creator or buyer text), and `jsonLdText` escapes <, > and & so it cannot end the tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  // Our own escaped JSON (see jsonLdText), never user content, so dangerouslySetInnerHTML is safe here.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />;
}
