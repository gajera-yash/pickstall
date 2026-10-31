import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ProductPage } from "@/components/store/product-page";
import { APP_NAME } from "@/lib/config";
import { findPublicProduct, findPublicStore } from "@/lib/stores/public";

// Public product page at /@username/product-slug (rewrite in next.config.ts). Only a published
// product of a published store is shown; anything else is a real 404. `connection()` renders per request.


function safeUrl(value: string | null): string | undefined {
  try {
    return value && new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function generateMetadata({ params }: PageProps<"/s/[username]/[productSlug]">): Promise<Metadata> {
  await connection();
  const { username, productSlug } = await params;
  const store = await findPublicStore(username);
  const product = store ? await findPublicProduct(store.id, productSlug) : null;
  if (!store || !product) return { title: `Not found | ${APP_NAME}`, robots: { index: false } };
  const description = product.description?.slice(0, 160) ?? `${product.title} by ${store.name}`;
  const image = safeUrl(product.coverUrl);
  return {
    title: `${product.title} by ${store.name} | ${APP_NAME}`,
    description,
    openGraph: { title: product.title, description, type: "website", ...(image ? { images: [image] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title: product.title, description },
  };
}

export default async function PublicProductPage({ params }: PageProps<"/s/[username]/[productSlug]">) {
  await connection();
  const { username, productSlug } = await params;
  const store = await findPublicStore(username);
  if (!store) notFound();
  const product = await findPublicProduct(store.id, productSlug);
  if (!product) notFound();
  return <ProductPage store={store} product={product} />;
}
