import "server-only";

import { randomUUID } from "node:crypto";

import { PRODUCT_FILE_MAX_BYTES } from "@/lib/config";
import { collections, type FileDoc } from "@/lib/db/collections";
import { readFileStream, removeFile, writeFileStream } from "@/lib/files/storage";
import { PRODUCT_FILE_LABELS, PRODUCT_FILE_TYPES, cleanFileName, detectFileType, type ProductFileInfo } from "@/lib/files/types";
import { logger } from "@/lib/logger";

// Product files (D-050): saving a creator's upload and finding it again for a buyer. Every query
// filters by the store id, which comes from the verified session (creator) or from the buyer's own
// paid order, never from the request (CLAUDE.md 6).

export type { ProductFileInfo };

export type SaveFileResult = { ok: true; data: ProductFileInfo } | { ok: false; error: string; status: number };

const toInfo = (doc: Pick<FileDoc, "_id" | "name" | "size" | "ext">): ProductFileInfo => ({
  id: doc._id,
  name: doc.name,
  size: doc.size,
  label: PRODUCT_FILE_TYPES[doc.ext]?.label ?? doc.ext.toUpperCase(),
});

/** Removes a file's record and its bytes. Bytes go last, so a failed delete never leaves a record without a file. */
async function dropFile(doc: Pick<FileDoc, "_id" | "key" | "storeId">): Promise<void> {
  const { files } = await collections();
  await files.deleteOne({ _id: doc._id, storeId: doc.storeId });
  await removeFile(doc.key).catch((error: unknown) => logger.warn("files.remove_failed", { name: error instanceof Error ? error.name : undefined }));
}

/**
 * Saves an upload as the product's file and switches the product to file delivery. The product
 * must belong to `storeId`. The type comes from the file's own bytes and its name together, the
 * size is capped while streaming, and the old file (if any) is removed once the new one is in.
 */
export async function saveProductFile(storeId: string, productId: string, rawName: string, body: ReadableStream<Uint8Array>): Promise<SaveFileResult> {
  const { products, files } = await collections();
  const product = await products.findOne({ _id: productId, storeId }, { projection: { fileId: 1 } });
  if (!product) return { ok: false, error: "We couldn't find that product.", status: 404 };

  const id = randomUUID();
  const key = randomUUID();
  const written = await writeFileStream(key, body, PRODUCT_FILE_MAX_BYTES);
  if (!written.ok) {
    return written.reason === "too_large"
      ? { ok: false, error: `Use a file under ${PRODUCT_FILE_MAX_BYTES / 1024 / 1024} MB.`, status: 413 }
      : { ok: false, error: "That file is empty.", status: 400 };
  }

  const type = detectFileType(rawName, written.head);
  if (!type) {
    await removeFile(key);
    return { ok: false, error: `Use one of these file types: ${PRODUCT_FILE_LABELS}.`, status: 415 };
  }

  const doc: FileDoc = { _id: id, storeId, productId, key, name: cleanFileName(rawName, type.ext), ext: type.ext, mime: type.mime, size: written.size, createdAt: new Date() };
  try {
    await files.insertOne(doc);
    const updated = await products.updateOne({ _id: productId, storeId }, { $set: { fileId: id, deliveryType: "file", updatedAt: new Date() } });
    if (updated.matchedCount !== 1) {
      await dropFile(doc);
      return { ok: false, error: "We couldn't find that product.", status: 404 };
    }
  } catch (error) {
    await files.deleteOne({ _id: id, storeId }).catch(() => undefined);
    await removeFile(key).catch(() => undefined);
    throw error;
  }

  if (product.fileId && product.fileId !== id) {
    const old = await files.findOne({ _id: product.fileId, storeId }, { projection: { key: 1, storeId: 1 } });
    if (old) await dropFile(old);
  }
  return { ok: true, data: toInfo(doc) };
}

/** Removes the product's file and goes back to link delivery. Only for the store's own product. */
export async function removeProductFile(storeId: string, productId: string): Promise<boolean> {
  const { products, files } = await collections();
  const product = await products.findOne({ _id: productId, storeId }, { projection: { fileId: 1 } });
  if (!product) return false;
  await products.updateOne({ _id: productId, storeId }, { $set: { fileId: null, deliveryType: "link", updatedAt: new Date() } });
  if (product.fileId) {
    const old = await files.findOne({ _id: product.fileId, storeId }, { projection: { key: 1, storeId: 1 } });
    if (old) await dropFile(old);
  }
  return true;
}

/** Removes every file of a product that is being deleted. */
export async function removeFilesOfProduct(storeId: string, productId: string): Promise<void> {
  const { files } = await collections();
  const docs = await files.find({ storeId, productId }, { projection: { key: 1, storeId: 1 } }).toArray();
  for (const doc of docs) await dropFile(doc);
}

/** The product's file details for the editor, or null. */
export async function findProductFile(storeId: string, fileId: string | null | undefined): Promise<ProductFileInfo | null> {
  if (!fileId) return null;
  const { files } = await collections();
  const doc = await files.findOne({ _id: fileId, storeId }, { projection: { name: 1, size: 1, ext: 1 } });
  return doc ? toInfo(doc) : null;
}

/** A file to send to a buyer: its bytes as a stream plus what the response needs. */
export async function openFileForDownload(storeId: string, fileId: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number; name: string; mime: string } | null> {
  const { files } = await collections();
  const doc = await files.findOne({ _id: fileId, storeId }, { projection: { key: 1, name: 1, mime: 1 } });
  if (!doc) return null;
  const file = await readFileStream(doc.key);
  return file ? { ...file, name: doc.name, mime: doc.mime } : null;
}
