import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductPage } from "@/components/store/product-page";
import { APP_NAME } from "@/lib/config";
import { publicEnv } from "@/lib/env";
import { absoluteImageUrl } from "@/lib/media/media";
import { findPublicProduct, findPublicStore } from "@/lib/stores/public";

// Public product page at /@username/product-slug (rewrite in next.config.ts). Only a published
// product of a published store is shown; anything else is a real 404.
export const instant = false;



export async function generateMetadata({ params }: PageProps<"/s/[username]/[productSlug]">): Promise<Metadata> {
  const { username, productSlug } = await params;
  const store = await findPublicStore(username);
  const product = store ? await findPublicProduct(store.id, productSlug) : null;
  if (!store || !product) return { title: `Not found | ${APP_NAME}`, robots: { index: false } };
  const description = product.description?.slice(0, 160) ?? `${product.title} by ${store.name}`;
  const image = absoluteImageUrl(product.coverUrl, publicEnv.NEXT_PUBLIC_APP_URL);
  return {
    title: `${product.title} by ${store.name} | ${APP_NAME}`,
    description,
    openGraph: { title: product.title, description, type: "website", ...(image ? { images: [image] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title: product.title, description },
  };
}

export default async function PublicProductPage({ params }: PageProps<"/s/[username]/[productSlug]">) {
  const { username, productSlug } = await params;
  const store = await findPublicStore(username);
  if (!store) notFound();
  const product = await findPublicProduct(store.id, productSlug);
  if (!product) notFound();
  return <ProductPage store={store} product={product} />;
}
