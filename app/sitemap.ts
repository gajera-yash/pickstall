import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { publicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sitemapStores } from "@/lib/stores/sitemap";

// The sitemap: marketing and legal pages, then every live store and its published products.
const MARKETING = ["", "/signup", "/terms", "/privacy", "/refunds", "/cookies", "/acceptable-use", "/copyright"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const entries: MetadataRoute.Sitemap = MARKETING.map((path) => ({ url: `${base}${path || "/"}` }));
  try {
    for (const store of await sitemapStores()) {
      entries.push({ url: `${base}/@${store.slug}`, ...(store.updatedAt ? { lastModified: store.updatedAt } : {}) });
      for (const product of store.products) entries.push({ url: `${base}/@${store.slug}/${product.slug}`, ...(product.updatedAt ? { lastModified: product.updatedAt } : {}) });
    }
  } catch (error) {
    // The marketing pages are still listed if the database is unreachable.
    logger.error("sitemap.stores_failed", { name: error instanceof Error ? error.name : undefined });
  }
  return entries;
}
