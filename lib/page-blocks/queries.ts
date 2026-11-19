import "server-only";

import { collections } from "@/lib/db/collections";
import type { PageBlock } from "@/lib/page-blocks/rules";

// Store page sections (D-101), always with the store id from the verified session.

export async function findPageBlocks(storeId: string): Promise<PageBlock[]> {
  const { stores } = await collections();
  const store = await stores.findOne({ _id: storeId }, { projection: { pageBlocks: 1 } });
  return store?.pageBlocks ?? [];
}

export async function savePageBlocks(storeId: string, blocks: PageBlock[]): Promise<void> {
  const { stores } = await collections();
  await stores.updateOne({ _id: storeId }, { $set: { pageBlocks: blocks, updatedAt: new Date() } });
}
