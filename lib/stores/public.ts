import "server-only";

import { collections, type ProductDoc, type StoreDoc } from "@/lib/db/collections";
import { socialLinksOf } from "@/lib/stores/social-links";
import type { SocialLink } from "@/lib/stores/schemas";

// Reads for the public store and product pages (/@username). Anyone can call these, so each one
// filters on "published" and returns only an explicit allow-list of fields through a projection:
// never the owner, Stripe ids, the delivery link, the checkout settings or the email texts.

export type PublicStore = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  socialLinks: SocialLink[];
  theme: StoreDoc["theme"];
  currency: StoreDoc["currency"];
};

export type PublicProduct = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  pricingModel: ProductDoc["pricingModel"];
  priceCents: number;
  minPriceCents: number | null;
  buttonText: string | null;
};

const STORE_FIELDS = { slug: 1, name: 1, bio: 1, avatarUrl: 1, socialLinks: 1, link: 1, theme: 1, currency: 1 } as const;
const PRODUCT_FIELDS = { slug: 1, title: 1, description: 1, coverUrl: 1, pricingModel: 1, priceCents: 1, minPriceCents: 1, buttonText: 1 } as const;

const SLUG = /^[a-z0-9-]{3,30}$/;
const PRODUCT_SLUG = /^[a-z0-9-]{1,60}$/;

/** A published store by its username, or null (a draft store looks exactly like a missing one). */
export async function findPublicStore(slug: string): Promise<PublicStore | null> {
  if (typeof slug !== "string" || !SLUG.test(slug)) return null;
  const { stores } = await collections();
  const doc = await stores.findOne({ slug, isPublished: true }, { projection: STORE_FIELDS });
  if (!doc) return null;
  return {
    id: doc._id,
    slug: doc.slug,
    name: doc.name,
    bio: doc.bio,
    avatarUrl: doc.avatarUrl,
    socialLinks: socialLinksOf(doc),
    theme: doc.theme,
    currency: doc.currency,
  };
}

function toPublicProduct(doc: Pick<ProductDoc, "_id" | "slug" | "title" | "description" | "coverUrl" | "pricingModel" | "priceCents" | "minPriceCents" | "buttonText">): PublicProduct {
  return {
    id: doc._id,
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    coverUrl: doc.coverUrl,
    pricingModel: doc.pricingModel,
    priceCents: doc.priceCents,
    minPriceCents: doc.minPriceCents,
    buttonText: doc.buttonText,
  };
}

/** The published products of a (published) store, in the creator's order. */
export async function listPublicProducts(storeId: string): Promise<PublicProduct[]> {
  const { products } = await collections();
  const docs = await products.find({ storeId, status: "published" }, { projection: PRODUCT_FIELDS }).sort({ sortOrder: 1, createdAt: -1 }).limit(100).toArray();
  return docs.map(toPublicProduct);
}

/** One published product of a store by its slug, or null. */
export async function findPublicProduct(storeId: string, slug: string): Promise<PublicProduct | null> {
  if (typeof storeId !== "string" || typeof slug !== "string" || !PRODUCT_SLUG.test(slug)) return null;
  const { products } = await collections();
  const doc = await products.findOne({ storeId, slug, status: "published" }, { projection: PRODUCT_FIELDS });
  return doc ? toPublicProduct(doc) : null;
}
