import type { StoreDoc } from "@/lib/db/collections";
import type { SocialLink } from "@/lib/stores/schemas";

/** Social links, with the old single `link` as a website link until the migration has run (D-028). */
export function socialLinksOf(doc: Pick<StoreDoc, "socialLinks" | "link">): SocialLink[] {
  if (doc.socialLinks) return doc.socialLinks;
  return doc.link ? [{ kind: "website", url: doc.link }] : [];
}
