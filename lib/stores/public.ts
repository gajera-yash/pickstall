import "server-only";

import type { CourseCategory } from "@/lib/courses/settings";
import { collections, type ProductDoc, type StoreDoc } from "@/lib/db/collections";
import { socialLinksOf } from "@/lib/stores/social-links";
import type { RichDoc } from "@/lib/products/rich-text";
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
  /** Rich description (D-049), or null for products saved before it (show `description`). */
  descriptionDoc: RichDoc | null;
  coverUrl: string | null;
  priceCents: number;
  /** Discounted price (D-047), or null. */
  salePriceCents: number | null;
  buttonText: string | null;
  /** "digital" or "course" (D-054). */
  type: ProductDoc["type"];
  /** A course's public facts (category, access period); null for a digital product. */
  course: { category: CourseCategory | null; accessDays: number | null } | null;
};

/** A published course's outline for its public page (D-056): titles only, never lesson content. */
export type PublicCurriculum = { modules: { title: string; lessons: { title: string; hasVideo: boolean }[] }[] };

const STORE_FIELDS = { slug: 1, name: 1, bio: 1, avatarUrl: 1, socialLinks: 1, link: 1, theme: 1, currency: 1 } as const;
const PRODUCT_FIELDS = { slug: 1, title: 1, description: 1, descriptionDoc: 1, coverUrl: 1, priceCents: 1, salePriceCents: 1, buttonText: 1, type: 1, "course.category": 1, "course.accessDays": 1 } as const;

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

function toPublicProduct(doc: Pick<ProductDoc, "_id" | "slug" | "title" | "description" | "descriptionDoc" | "coverUrl" | "priceCents" | "salePriceCents" | "buttonText" | "type" | "course">): PublicProduct {
  return {
    id: doc._id,
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    descriptionDoc: doc.descriptionDoc ?? null,
    coverUrl: doc.coverUrl,
    priceCents: doc.priceCents,
    // Products saved before D-047 have no discount field yet.
    salePriceCents: doc.salePriceCents ?? null,
    buttonText: doc.buttonText,
    type: doc.type ?? "digital",
    course: doc.type === "course" ? { category: doc.course?.category ?? null, accessDays: doc.course?.accessDays ?? null } : null,
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

/**
 * The outline of a published course of a store (D-056): module and lesson titles, and whether a
 * lesson has a video. Nothing else of a lesson is read: no video ids, notes, files or links.
 */
export async function findPublicCurriculum(storeId: string, courseId: string): Promise<PublicCurriculum | null> {
  if (typeof storeId !== "string" || typeof courseId !== "string") return null;
  const { products, courseModules, lessons } = await collections();
  if ((await products.countDocuments({ _id: courseId, storeId, type: "course", status: "published" }, { limit: 1 })) !== 1) return null;
  const [moduleDocs, lessonDocs] = await Promise.all([
    courseModules.find({ storeId, productId: courseId }, { projection: { title: 1 } }).sort({ sortOrder: 1 }).toArray(),
    lessons.find({ storeId, productId: courseId }, { projection: { title: 1, moduleId: 1, "video.kind": 1 } }).sort({ sortOrder: 1 }).toArray(),
  ]);
  return {
    modules: moduleDocs.map((item) => ({
      title: item.title,
      lessons: lessonDocs.filter((lesson) => lesson.moduleId === item._id).map((lesson) => ({ title: lesson.title, hasVideo: Boolean(lesson.video) })),
    })),
  };
}
