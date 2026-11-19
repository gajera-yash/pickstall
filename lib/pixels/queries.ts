import "server-only";

import { collections } from "@/lib/db/collections";
import type { StorePixels } from "@/lib/pixels/rules";

// Store pixel settings (D-097), always with the store id from the verified session.

export async function findPixelSettings(storeId: string): Promise<StorePixels> {
  const { stores } = await collections();
  const store = await stores.findOne({ _id: storeId }, { projection: { pixels: 1 } });
  return store?.pixels ?? { metaPixelId: null, googleTagId: null };
}

export async function savePixelSettings(storeId: string, pixels: StorePixels): Promise<void> {
  const { stores } = await collections();
  await stores.updateOne({ _id: storeId }, { $set: { pixels } });
}
