import "server-only";

import { collections, type FileDoc } from "@/lib/db/collections";
import { r2DownloadUrl } from "@/lib/files/r2";
import { readFileStream, removeStoredFile } from "@/lib/files/storage";
import { attachmentHeader, type ProductFileInfo } from "@/lib/files/types";
import { toFileInfo } from "@/lib/files/uploads";
import { logger } from "@/lib/logger";

// Product files (D-050): removing and finding a creator's file, and delivering it to a buyer.
// Uploads go through ./uploads.ts (D-093). Every query
// filters by the store id, which comes from the verified session (creator) or from the buyer's own
// paid order, never from the request (CLAUDE.md 6).

export type { ProductFileInfo };

/** Removes a file's record and its bytes. Bytes go last, so a failed delete never leaves a record without a file. */
async function dropFile(doc: Pick<FileDoc, "_id" | "key" | "storeId" | "storage">): Promise<void> {
  const { files } = await collections();
  await files.deleteOne({ _id: doc._id, storeId: doc.storeId });
  await removeStoredFile(doc.storage, doc.key).catch((error: unknown) => logger.warn("files.remove_failed", { name: error instanceof Error ? error.name : undefined }));
}

/** Removes the product's file and goes back to link delivery. Only for the store's own product. */
export async function removeProductFile(storeId: string, productId: string): Promise<boolean> {
  const { products, files } = await collections();
  const product = await products.findOne({ _id: productId, storeId }, { projection: { fileId: 1 } });
  if (!product) return false;
  await products.updateOne({ _id: productId, storeId }, { $set: { fileId: null, deliveryType: "link", updatedAt: new Date() } });
  if (product.fileId) {
    const old = await files.findOne({ _id: product.fileId, storeId }, { projection: { key: 1, storeId: 1, storage: 1 } });
    if (old) await dropFile(old);
  }
  return true;
}

/** Removes every file of a product that is being deleted. */
export async function removeFilesOfProduct(storeId: string, productId: string): Promise<void> {
  const { files } = await collections();
  const docs = await files.find({ storeId, productId }, { projection: { key: 1, storeId: 1, storage: 1 } }).toArray();
  for (const doc of docs) await dropFile(doc);
}

/** The product's file details for the editor, or null. */
export async function findProductFile(storeId: string, fileId: string | null | undefined): Promise<ProductFileInfo | null> {
  if (!fileId) return null;
  const { files } = await collections();
  const doc = await files.findOne({ _id: fileId, storeId, status: { $ne: "pending" } }, { projection: { name: 1, size: 1, ext: 1 } });
  return doc ? toFileInfo(doc) : null;
}

/**
 * How to hand a file to a buyer, after the caller's order checks: a 60-second signed R2 link to
 * redirect to (D-093), or the bytes from the disk to stream (D-050). Null when it is missing.
 */
export type FileDelivery = { kind: "redirect"; url: string } | { kind: "stream"; stream: ReadableStream<Uint8Array>; size: number; name: string; mime: string };

export async function openFileForDownload(storeId: string, fileId: string): Promise<FileDelivery | null> {
  const { files } = await collections();
  const doc = await files.findOne({ _id: fileId, storeId, status: { $ne: "pending" } }, { projection: { key: 1, name: 1, mime: 1, storage: 1 } });
  if (!doc) return null;
  if (doc.storage === "r2") return { kind: "redirect", url: await r2DownloadUrl(doc.key, attachmentHeader(doc.name), doc.mime) };
  const file = await readFileStream(doc.key);
  return file ? { kind: "stream", ...file, name: doc.name, mime: doc.mime } : null;
}
