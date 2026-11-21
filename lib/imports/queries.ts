import "server-only";

import { randomUUID } from "node:crypto";

import { PRODUCTS_MAX_PER_STORE } from "@/lib/config";
import { collections, type ProductDoc } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import type { ImportCandidate } from "@/lib/imports/rules";
import { logger } from "@/lib/logger";
import { saveImageUpload } from "@/lib/media/uploads";
import { MEDIA_MAX_BYTES } from "@/lib/media/media";
import { docFromPlainText } from "@/lib/products/rich-text";
import { slugFromTitle } from "@/lib/products/slug";

// Writes for product import. The store id comes from the verified session (requireCreator); every
// insert carries it, and the unique index on (storeId, source, externalId) makes a repeat import
// skip what is already there.

export type ImportResult = { added: number; skipped: number; limit: boolean };

/** Copies a Gumroad thumbnail into our own image storage (the caller checked the host). Null on any problem. */
async function copyCover(storeId: string, url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: "error" });
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MEDIA_MAX_BYTES) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MEDIA_MAX_BYTES) return null;
    const saved = await saveImageUpload(storeId, "cover", bytes);
    return saved.ok ? saved.data.url : null;
  } catch (error) {
    logger.warn("imports.cover_copy_failed", { name: error instanceof Error ? error.name : undefined });
    return null;
  }
}

/** Adds the candidates as draft digital products of this store. Already imported items are skipped. */
export async function importDraftProducts(storeId: string, candidates: ImportCandidate[], now = new Date()): Promise<ImportResult> {
  const { products } = await collections();
  const result: ImportResult = { added: 0, skipped: 0, limit: false };
  let count = await products.countDocuments({ storeId, deletedAt: null });

  for (const item of candidates) {
    if (item.skipReason) {
      result.skipped += 1;
      continue;
    }
    // Already imported (the index would refuse it too; this saves copying the cover again).
    if (await products.findOne({ storeId, "importedFrom.source": item.source, "importedFrom.externalId": item.externalId }, { projection: { _id: 1 } })) {
      result.skipped += 1;
      continue;
    }
    if (count >= PRODUCTS_MAX_PER_STORE) {
      result.limit = true;
      break;
    }
    const coverUrl = item.coverSourceUrl ? await copyCover(storeId, item.coverSourceUrl) : null;
    const base = slugFromTitle(item.title);
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const doc: ProductDoc = {
        _id: randomUUID(),
        storeId,
        importedFrom: { source: item.source, externalId: item.externalId, importedAt: now },
        type: "digital",
        title: item.title,
        slug: attempt === 0 ? base : `${base.slice(0, 45)}-${randomUUID().slice(0, 4)}`,
        description: item.description,
        descriptionDoc: item.description ? docFromPlainText(item.description) : null,
        coverUrl,
        priceCents: item.priceCents ?? 0,
        salePriceCents: null,
        // Files can't be copied from other platforms: the creator adds the link or file, then publishes.
        externalUrl: null,
        deliveryType: "link",
        fileId: null,
        buttonText: "Buy now",
        downloadLimit: null,
        status: "draft",
        checkout: { headline: null, askPhone: false, questions: [] },
        afterPurchase: { thankYou: null, redirectUrl: null, emailSubject: null, emailBody: null },
        sortOrder: Date.now(),
        createdAt: now,
        updatedAt: now,
      };
      try {
        await products.insertOne(doc);
        inserted = true;
      } catch (error) {
        if (isDuplicateKeyError(error, "importedFrom.externalId")) break; // imported meanwhile
        if (!isDuplicateKeyError(error, "slug")) throw error;
      }
    }
    if (inserted) {
      result.added += 1;
      count += 1;
    } else {
      result.skipped += 1;
    }
  }
  return result;
}
