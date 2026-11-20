import "server-only";

import { collections, type ProductDoc } from "@/lib/db/collections";
import type { CourseDetailsInput } from "@/lib/courses/schemas";
import { saveWithSlug, type SaveProductResult } from "@/lib/products/queries";

// Course writes for the signed-in creator (course flow G1, D-054). A course is a product with
// type "course"; as with products, the `storeId` filter of `requireCreator()` IS the access check,
// and the type filter keeps the course editor from writing a digital product.

/** Saves the Basic and Pricing steps. The slug follows the title until the course is published. */
export async function updateCourseDetails(storeId: string, id: string, input: CourseDetailsInput): Promise<SaveProductResult> {
  const { products } = await collections();
  const filter = { _id: id, storeId, type: "course" as const, deletedAt: null };
  const current = await products.findOne(filter, { projection: { status: 1, slug: 1 } });
  if (!current) return "not_found";

  return saveWithSlug(filter, current, input.title, {
    title: input.title,
    description: input.description,
    descriptionDoc: input.descriptionDoc,
    coverUrl: input.coverUrl,
    priceCents: input.priceCents,
    salePriceCents: input.salePriceCents,
    updatedAt: new Date(),
    // Dotted paths, so saving steps 1-2 never touches the drip setting of step 4.
    ...({
      "course.category": input.course.category,
      "course.tags": input.course.tags,
      "course.accessDays": input.course.accessDays,
      // Only the email fields of afterPurchase (D-078); courses have no thank-you page or redirect.
      "afterPurchase.emailSubject": input.emailSubject,
      "afterPurchase.emailBody": input.emailBody,
    } as Partial<ProductDoc>),
  });
}

/** Turns certificates on or off for this store's course (D-111). Certificates already issued stay valid. */
export async function updateCourseCertificate(storeId: string, courseId: string, enabled: boolean): Promise<SaveProductResult> {
  const { products } = await collections();
  const result = await products.updateOne({ _id: courseId, storeId, type: "course", deletedAt: null }, { $set: { "course.certificate": enabled, updatedAt: new Date() } });
  return result.matchedCount === 1 ? "saved" : "not_found";
}

export type ReleaseInput = { drip: boolean; modules: { id: string; dripDays: number }[] };

/**
 * Saves how the course opens (D-056): all at once, or module by module N days after purchase.
 * Only this store's course and its own modules are written.
 */
export async function updateCourseRelease(storeId: string, courseId: string, input: ReleaseInput): Promise<SaveProductResult> {
  const { products, courseModules } = await collections();
  const result = await products.updateOne({ _id: courseId, storeId, type: "course", deletedAt: null }, { $set: { "course.drip": input.drip, updatedAt: new Date() } });
  if (result.matchedCount !== 1) return "not_found";
  if (input.modules.length > 0) {
    const now = new Date();
    await courseModules.bulkWrite(
      input.modules.map((item) => ({
        updateOne: { filter: { _id: item.id, storeId, productId: courseId }, update: { $set: { dripDays: item.dripDays, updatedAt: now } } },
      })),
      { ordered: false },
    );
  }
  return "saved";
}
