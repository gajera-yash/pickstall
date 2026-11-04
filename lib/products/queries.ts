import "server-only";

import { randomUUID } from "node:crypto";

import type { Filter } from "mongodb";

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

/** Not deleted by the creator (D-059). Matches a missing or null `deletedAt`. */
const NOT_DELETED = { deletedAt: null };

export async function listProducts(storeId: string): Promise<CreatorProduct[]> {
  const { products } = await collections();
  const docs = await products.find({ storeId, ...NOT_DELETED }).sort({ sortOrder: 1, createdAt: -1 }).limit(PRODUCTS_MAX_PER_STORE).toArray();
  return docs.map(toCreatorProduct);
}

export async function countProducts(storeId: string, status?: ProductDoc["status"]): Promise<number> {
  const { products } = await collections();
  return products.countDocuments(status ? { storeId, status, ...NOT_DELETED } : { storeId, status: { $ne: "archived" }, ...NOT_DELETED });
}

/** One product of this store, or null (also for another store's product: no way to tell them apart). */
export async function findProduct(storeId: string, id: string): Promise<CreatorProduct | null> {
  const { products } = await collections();
  const doc = await products.findOne({ _id: id, storeId, ...NOT_DELETED });
  return doc ? toCreatorProduct(doc) : null;
}

export type CreateProductResult = { id: string } | "limit" | "error";

const DRAFT_TITLES: Record<ProductDoc["type"], string> = { digital: "Untitled product", course: "Untitled course" };

/** True for a product fresh from "Create" that has never been named (the editor opens on step 1). */
export function isUnnamedDraft(product: Pick<ProductDoc, "status" | "title" | "type">): boolean {
  return product.status === "draft" && product.title === DRAFT_TITLES[product.type];
}

/**
 * Creates an empty draft product of `type` (a digital product, or a course with lifetime access).
 * The unique index keeps slugs unique; a clash gets a suffix.
 */
export async function createDraftProduct(storeId: string, defaults: { buttonText: string; type?: ProductDoc["type"] }): Promise<CreateProductResult> {
  const { products } = await collections();
  if ((await products.countDocuments({ storeId, ...NOT_DELETED })) >= PRODUCTS_MAX_PER_STORE) return "limit";

  const type = defaults.type ?? "digital";
  const now = new Date();
  const base = slugFromTitle(DRAFT_TITLES[type]);
  for (let attempt = 0; attempt < 5; attempt++) {
    const doc: ProductDoc = {
      _id: randomUUID(),
      storeId,
      type,
      ...(type === "course" ? { course: { category: null, tags: [], accessDays: null } } : {}),
      title: DRAFT_TITLES[type],
      slug: attempt === 0 ? base : `${base}-${randomUUID().slice(0, 4)}`,
      description: null,
      descriptionDoc: null,
      coverUrl: null,
      priceCents: 0,
      salePriceCents: null,
      externalUrl: null,
      deliveryType: "link",
      fileId: null,
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
  // The digital editor never writes a course (courses save through lib/courses/queries.ts).
  const current = await products.findOne({ _id: id, storeId, type: { $ne: "course" }, ...NOT_DELETED }, { projection: { status: 1, slug: 1, title: 1 } });
  if (!current) return "not_found";

  const set: Partial<ProductDoc> = {
    title: input.title ?? current.title,
    description: input.description ?? null,
    descriptionDoc: input.descriptionDoc,
    coverUrl: input.coverUrl ?? null,
    externalUrl: input.externalUrl ?? null,
    deliveryType: input.deliveryType,
    priceCents: input.priceCents,
    salePriceCents: input.salePriceCents,
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

  // Saving also clears the pay-what-you-want fields from before D-047.
  return saveWithSlug({ _id: id, storeId, type: { $ne: "course" }, ...NOT_DELETED }, current, input.title ?? current.title, set, { pricingModel: "", minPriceCents: "" });
}

/**
 * Writes `set` to the product matching `filter` (which must include the store id). The slug follows
 * the title while the product is a draft, then stays stable; a clash with another product of the
 * store gets a short suffix.
 */
export async function saveWithSlug(
  filter: Filter<ProductDoc>,
  current: Pick<ProductDoc, "status" | "slug">,
  title: string,
  set: Partial<ProductDoc>,
  unset: Record<string, ""> = {},
): Promise<SaveProductResult> {
  const { products } = await collections();
  const wantedSlug = current.status === "draft" ? slugFromTitle(title) : current.slug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? wantedSlug : `${wantedSlug.slice(0, 45)}-${randomUUID().slice(0, 4)}`;
    try {
      const result = await products.updateOne(filter, { $set: { ...set, slug }, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) });
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
  const result = await products.updateOne({ _id: id, storeId, ...NOT_DELETED }, { $set: { status, updatedAt: new Date() } });
  return result.matchedCount === 1;
}

export type DeleteProductResult = "deleted" | "hidden" | "not_found";

/**
 * Deletes one of this store's products (D-059). Without any order it is removed for good (the
 * caller then removes its files and lessons). With orders it is hidden instead: archived, marked
 * `deletedAt` and its link freed, so it leaves the store and the dashboard while its buyers keep
 * their library access and the creator keeps the orders.
 */
export async function deleteProduct(storeId: string, id: string): Promise<DeleteProductResult> {
  const { products, orders } = await collections();
  const product = await products.findOne({ _id: id, storeId, ...NOT_DELETED }, { projection: { slug: 1 } });
  if (!product) return "not_found";
  if ((await orders.countDocuments({ storeId, productId: id }, { limit: 1 })) === 0) {
    const result = await products.deleteOne({ _id: id, storeId, ...NOT_DELETED });
    return result.deletedCount === 1 ? "deleted" : "not_found";
  }
  const now = new Date();
  const result = await products.updateOne(
    { _id: id, storeId, ...NOT_DELETED },
    { $set: { deletedAt: now, status: "archived", slug: `${product.slug.slice(0, 40)}-deleted-${randomUUID().slice(0, 6)}`, updatedAt: now } },
  );
  return result.matchedCount === 1 ? "hidden" : "not_found";
}
