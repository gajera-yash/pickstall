import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StorePage } from "@/components/store/store-page";
import { APP_NAME } from "@/lib/config";
import { findPublicStore, listPublicProducts } from "@/lib/stores/public";

// Public store page, served at /@username by a rewrite in next.config.ts (D-010). A draft or unknown
// store is a real 404. The page is rendered per request so a publish or edit shows at once.
export const instant = false;

function safeUrl(value: string | null): string | undefined {
  try {
    return value && new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function generateMetadata({ params }: PageProps<"/s/[username]">): Promise<Metadata> {
  const { username } = await params;
  const store = await findPublicStore(username);
  if (!store) return { title: `Not found | ${APP_NAME}`, robots: { index: false } };
  const description = store.bio ?? `Shop ${store.name} on ${APP_NAME}.`;
  const image = safeUrl(store.avatarUrl);
  return {
    title: `${store.name} | ${APP_NAME}`,
    description,
    openGraph: { title: store.name, description, type: "website", ...(image ? { images: [image] } : {}) },
    twitter: { card: "summary", title: store.name, description },
  };
}

export default async function PublicStorePage({ params }: PageProps<"/s/[username]">) {
  const { username } = await params;
  const store = await findPublicStore(username);
  if (!store) notFound();
  const products = await listPublicProducts(store.id);
  return <StorePage store={store} products={products} />;
}
