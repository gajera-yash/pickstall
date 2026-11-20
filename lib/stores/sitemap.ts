import "server-only";

import { collections } from "@/lib/db/collections";

// Public pages for the sitemap: published, not suspended stores and their published products.
// Only public fields (slugs and dates) are read; nothing that identifies a creator or a buyer.

const MAX_STORES = 5000;
const MAX_PRODUCTS = 40000;

export type SitemapStore = { slug: string; updatedAt: Date | null; products: { slug: string; updatedAt: Date | null }[] };

export async function sitemapStores(): Promise<SitemapStore[]> {
  const { stores, products } = await collections();
  const storeDocs = await stores
    .find({ isPublished: true, suspendedAt: { $in: [null] }, deletedAt: { $exists: false } }, { projection: { slug: 1, updatedAt: 1 } })
    .sort({ createdAt: 1 })
    .limit(MAX_STORES)
    .toArray();
  const ids = storeDocs.map((store) => store._id);
  const productDocs = await products
    .find({ storeId: { $in: ids }, status: "published", deletedAt: { $in: [null] } }, { projection: { storeId: 1, slug: 1, updatedAt: 1 } })
    .limit(MAX_PRODUCTS)
    .toArray();
  const byStore = new Map<string, { slug: string; updatedAt: Date | null }[]>();
  for (const product of productDocs) {
    const list = byStore.get(product.storeId) ?? [];
    list.push({ slug: product.slug, updatedAt: product.updatedAt ?? null });
    byStore.set(product.storeId, list);
  }
  return storeDocs.map((store) => ({ slug: store.slug, updatedAt: store.updatedAt ?? null, products: byStore.get(store._id) ?? [] }));
}
