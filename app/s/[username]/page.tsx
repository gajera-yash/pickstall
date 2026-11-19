import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StorePage } from "@/components/store/store-page";
import { StorePaused } from "@/components/store/store-paused";
import { APP_NAME } from "@/lib/config";
import { publicEnv } from "@/lib/env";
import { absoluteImageUrl } from "@/lib/media/media";
import { StorePixels } from "@/components/store/store-pixels";
import { findPublicStore, listPublicProducts } from "@/lib/stores/public";

// Public store page, served at /@username by a rewrite in next.config.ts (D-010). A draft or unknown
// store is a real 404. The page is rendered per request so a publish or edit shows at once.
export const instant = false;



export async function generateMetadata({ params }: PageProps<"/s/[username]">): Promise<Metadata> {
  const { username } = await params;
  const store = await findPublicStore(username);
  if (!store) return { title: `Not found | ${APP_NAME}`, robots: { index: false } };
  const description = store.bio ?? `Shop ${store.name} on ${APP_NAME}.`;
  const image = absoluteImageUrl(store.avatarUrl, publicEnv.NEXT_PUBLIC_APP_URL);
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
  if (!store.isOpen) return <StorePaused storeName={store.name} theme={store.theme} />;
  const products = await listPublicProducts(store.id);
  return (
    <>
      <StorePage store={store} products={products} />
      {store.pixels && <StorePixels storeId={store.id} storeName={store.name} pixels={store.pixels} />}
    </>
  );
}
