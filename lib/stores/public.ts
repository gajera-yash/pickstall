import "server-only";

import type { PageBlock } from "@/lib/page-blocks/rules";
import { safePixels, type StorePixels } from "@/lib/pixels/rules";
import { connection } from "next/server";

import type { CourseCategory } from "@/lib/courses/settings";
import { collections, type ProductDoc, type StoreDoc } from "@/lib/db/collections";
import { can, storeAccess } from "@/lib/plans/access";
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
  /** False while the store is paused after its free trial (D-072). Only this flag is public, no plan details. */
  isOpen: boolean;
  /** Pixel IDs for the store's pages (D-097), only well-formed ones, none while paused. */
  pixels: StorePixels | null;
  /** Page sections around the products (D-101); empty: the page as before. */
  pageBlocks: PageBlock[];
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
  /** A course's public facts (category, access period, how many lessons); null for a digital product. */
  course: { category: CourseCategory | null; accessDays: number | null; lessonCount: number } | null;
  /** A coaching call's length (D-087); never its meeting link. Null for other products. Optional for preview callers. */
  coaching?: { durationMinutes: number } | null;
};

/** A published course's outline for its public page (D-056): titles only, never lesson content. */
export type PublicCurriculum = { modules: { title: string; lessons: { title: string; hasVideo: boolean }[] }[] };

// The plan fields only decide `isOpen` and are never returned; the billing customer id is not even read.
const STORE_FIELDS = {
  slug: 1,
  name: 1,
  bio: 1,
  avatarUrl: 1,
  socialLinks: 1,
  link: 1,
  theme: 1,
  currency: 1,
  planTier: 1, suspendedAt: 1,
  trialEndsAt: 1,
  foundingEndsAt: 1,
  "billing.plan": 1,
  "billing.status": 1,
  "billing.currentPeriodEnd": 1,
  "billing.cancelAtPeriodEnd": 1,
  pixels: 1,
  pageBlocks: 1,
} as const;
const PRODUCT_FIELDS = { slug: 1, title: 1, description: 1, descriptionDoc: 1, coverUrl: 1, priceCents: 1, salePriceCents: 1, buttonText: 1, type: 1, "course.category": 1, "course.accessDays": 1, "coaching.durationMinutes": 1 } as const;

const SLUG = /^[a-z0-9-]{3,30}$/;
const PRODUCT_SLUG = /^[a-z0-9-]{1,60}$/;

/** A published store by its username, or null (a draft store looks exactly like a missing one). */
export async function findPublicStore(slug: string): Promise<PublicStore | null> {
  if (typeof slug !== "string" || !SLUG.test(slug)) return null;
  // Request data, before the database is touched: open or paused depends on the current time, and the
  // database driver reads the clock, which Next refuses while prerendering.
  await connection();
  const { stores } = await collections();
  const doc = await stores.findOne({ slug, isPublished: true }, { projection: STORE_FIELDS });
  // A store suspended by a platform admin (D-105) looks exactly like a missing one.
  if (!doc || doc.suspendedAt) return null;
  return {
    id: doc._id,
    slug: doc.slug,
    name: doc.name,
    bio: doc.bio,
    avatarUrl: doc.avatarUrl,
    socialLinks: socialLinksOf(doc),
    theme: doc.theme,
    currency: doc.currency,
    isOpen: can(storeAccess(doc), "sell"),
    pixels: can(storeAccess(doc), "pixels") ? safePixels(doc.pixels) : null,
    pageBlocks: doc.pageBlocks ?? [],
  };
}

function toPublicProduct(
  doc: Pick<ProductDoc, "_id" | "slug" | "title" | "description" | "descriptionDoc" | "coverUrl" | "priceCents" | "salePriceCents" | "buttonText" | "type" | "course" | "coaching">,
  lessonCounts: Map<string, number> = new Map(),
): PublicProduct {
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
    course: doc.type === "course" ? { category: doc.course?.category ?? null, accessDays: doc.course?.accessDays ?? null, lessonCount: lessonCounts.get(doc._id) ?? 0 } : null,
    coaching: doc.type === "coaching" ? { durationMinutes: doc.coaching?.durationMinutes ?? 30 } : null,
  };
}

/** How many lessons each of these courses of the store has (D-063). Only a count leaves the lessons. */
export async function lessonCountsOf(storeId: string, docs: Pick<ProductDoc, "_id" | "type">[]): Promise<Map<string, number>> {
  const courseIds = docs.filter((doc) => doc.type === "course").map((doc) => doc._id);
  if (courseIds.length === 0) return new Map();
  const { lessons } = await collections();
  const rows = await lessons.aggregate<{ _id: string; count: number }>([{ $match: { storeId, productId: { $in: courseIds } } }, { $group: { _id: "$productId", count: { $sum: 1 } } }]).toArray();
  return new Map(rows.map((row) => [row._id, row.count]));
}

/** The published products of a (published) store, in the creator's order. */
export async function listPublicProducts(storeId: string): Promise<PublicProduct[]> {
  const { products } = await collections();
  const docs = await products.find({ storeId, status: "published" }, { projection: PRODUCT_FIELDS }).sort({ sortOrder: 1, createdAt: -1 }).limit(100).toArray();
  const counts = await lessonCountsOf(storeId, docs);
  return docs.map((doc) => toPublicProduct(doc, counts));
}

/** One published product of a store by its slug, or null. */
export async function findPublicProduct(storeId: string, slug: string): Promise<PublicProduct | null> {
  if (typeof storeId !== "string" || typeof slug !== "string" || !PRODUCT_SLUG.test(slug)) return null;
  const { products } = await collections();
  const doc = await products.findOne({ storeId, slug, status: "published" }, { projection: PRODUCT_FIELDS });
  return doc ? toPublicProduct(doc, await lessonCountsOf(storeId, [doc])) : null;
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
