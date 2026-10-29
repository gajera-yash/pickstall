import "server-only";

import { randomUUID } from "node:crypto";

import { PRODUCTS_MAX_PER_STORE } from "@/lib/config";
import { collections, type ProductDoc } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import type { ProductInput } from "@/lib/products/schemas";

// Product reads and writes for the signed-in creator. MongoDB has no row-level security, so the
// `storeId` filter IS the access check: callers pass the storeId of `requireCreator()` (the
// session owner's store), never an id taken from the client. A product id from the client is
// only ever combined with that storeId.

export type CreatorProduct = Omit<ProductDoc, "storeId">;

function toCreatorProduct(doc: ProductDoc): CreatorProduct {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the store id is dropped on purpose
  const { storeId, ...rest } = doc;
  return rest;
}

/** Slug from a title: lowercase letters, numbers and hyphens, at most 50 characters. */
export function slugFromTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
  return slug || "product";
}

export async function listProducts(storeId: string): Promise<CreatorProduct[]> {
  const { products } = await collections();
  const docs = await products.find({ storeId }).sort({ sortOrder: 1, createdAt: -1 }).limit(PRODUCTS_MAX_PER_STORE).toArray();
  return docs.map(toCreatorProduct);
}

export async function countProducts(storeId: string, status?: ProductDoc["status"]): Promise<number> {
  const { products } = await collections();
  return products.countDocuments(status ? { storeId, status } : { storeId, status: { $ne: "archived" } });
}

/** One product of this store, or null (also for another store's product: no way to tell them apart). */
export async function findProduct(storeId: string, id: string): Promise<CreatorProduct | null> {
  const { products } = await collections();
  const doc = await products.findOne({ _id: id, storeId });
  return doc ? toCreatorProduct(doc) : null;
}

export type CreateProductResult = { id: string } | "limit" | "error";

/** Creates an empty draft digital product. The unique index keeps slugs unique; a clash gets a suffix. */
export async function createDraftProduct(storeId: string, defaults: { buttonText: string }): Promise<CreateProductResult> {
  const { products } = await collections();
  if ((await products.countDocuments({ storeId })) >= PRODUCTS_MAX_PER_STORE) return "limit";

  const now = new Date();
  const base = "untitled-product";
  for (let attempt = 0; attempt < 5; attempt++) {
    const doc: ProductDoc = {
      _id: randomUUID(),
      storeId,
      type: "digital",
      title: "Untitled product",
      slug: attempt === 0 ? base : `${base}-${randomUUID().slice(0, 4)}`,
      description: null,
      coverUrl: null,
      pricingModel: "fixed",
      priceCents: 0,
      minPriceCents: null,
      externalUrl: null,
      buttonText: defaults.buttonText,
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
      return { id: doc._id };
    } catch (error) {
      if (!isDuplicateKeyError(error, "slug")) throw error;
    }
  }
  return "error";
}

export type SaveProductResult = "saved" | "not_found";

/** Saves the editor form. The slug follows the title until the product is published, then it stays stable. */
export async function updateProduct(storeId: string, id: string, input: ProductInput): Promise<SaveProductResult> {
  const { products } = await collections();
  const current = await products.findOne({ _id: id, storeId }, { projection: { status: 1, slug: 1, title: 1 } });
  if (!current) return "not_found";

  const set: Partial<ProductDoc> = {
    title: input.title ?? current.title,
    description: input.description ?? null,
    coverUrl: input.coverUrl ?? null,
    externalUrl: input.externalUrl ?? null,
    pricingModel: input.pricingModel,
    priceCents: input.priceCents,
    minPriceCents: input.minPriceCents,
    buttonText: input.buttonText ?? null,
    downloadLimit: input.downloadLimit ?? null,
    checkout: { headline: input.headline ?? null, askPhone: input.askPhone, questions: input.questions },
    afterPurchase: {
      thankYou: input.thankYou ?? null,
      redirectUrl: input.redirectUrl ?? null,
      emailSubject: input.emailSubject ?? null,
      emailBody: input.emailBody ?? null,
    },
    updatedAt: new Date(),
  };

  const wantedSlug = current.status === "draft" ? slugFromTitle(input.title ?? current.title) : current.slug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? wantedSlug : `${wantedSlug.slice(0, 45)}-${randomUUID().slice(0, 4)}`;
    try {
      const result = await products.updateOne({ _id: id, storeId }, { $set: { ...set, slug } });
      return result.matchedCount === 1 ? "saved" : "not_found";
    } catch (error) {
      if (!isDuplicateKeyError(error, "slug")) throw error;
    }
  }
  throw new Error("Could not find a free product link.");
}

/** Changes the status of one of this store's products. Publish rules are checked by the caller. */
export async function setProductStatus(storeId: string, id: string, status: ProductDoc["status"]): Promise<boolean> {
  const { products } = await collections();
  const result = await products.updateOne({ _id: id, storeId }, { $set: { status, updatedAt: new Date() } });
  return result.matchedCount === 1;
}

/** Deletes a draft or archived product of this store. A published product must be archived first. */
export async function deleteProduct(storeId: string, id: string): Promise<boolean> {
  const { products } = await collections();
  const result = await products.deleteOne({ _id: id, storeId, status: { $ne: "published" } });
  return result.deletedCount === 1;
}
