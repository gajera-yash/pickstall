import "server-only";

import type { PageBlock } from "@/lib/page-blocks/rules";
import type { CreatorProduct } from "@/lib/products/queries";
import { lessonCountsOf, type PublicProduct, type PublicStore } from "@/lib/stores/public";
import type { CreatorStore } from "@/lib/stores/queries";

/**
 * The creator's own store as the public page draws it (D-062), for the dashboard previews on My
 * Store and Store design: the same public fields, and only published products. Never pixels, and
 * always "open" (a paused store gets a banner in the dashboard instead).
 */
export async function storePreviewData(
  store: CreatorStore,
  products: CreatorProduct[],
  pageBlocks: PageBlock[],
): Promise<{ previewStore: PublicStore; previewProducts: PublicProduct[] }> {
  const previewStore: PublicStore = {
    id: store.id,
    slug: store.slug,
    name: store.name,
    bio: store.bio,
    avatarUrl: store.avatarUrl,
    socialLinks: store.socialLinks,
    theme: store.theme,
    currency: store.currency,
    isOpen: true,
    pixels: null,
    pageBlocks,
  };
  const published = products.filter((product) => product.status === "published");
  const lessonCounts = await lessonCountsOf(store.id, published).catch(() => new Map<string, number>());
  const previewProducts: PublicProduct[] = published.map((product) => ({
    id: product._id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    descriptionDoc: product.descriptionDoc ?? null,
    coverUrl: product.coverUrl,
    priceCents: product.priceCents,
    salePriceCents: product.salePriceCents ?? null,
    buttonText: product.buttonText,
    type: product.type,
    course: product.type === "course" ? { category: product.course?.category ?? null, accessDays: product.course?.accessDays ?? null, lessonCount: lessonCounts.get(product._id) ?? 0 } : null,
    coaching: product.type === "coaching" ? { durationMinutes: product.coaching?.durationMinutes ?? 30 } : null,
  }));
  return { previewStore, previewProducts };
}
