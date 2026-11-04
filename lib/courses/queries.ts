import "server-only";

import { collections } from "@/lib/db/collections";
import type { CourseDetailsInput } from "@/lib/courses/schemas";
import { saveWithSlug, type SaveProductResult } from "@/lib/products/queries";

// Course writes for the signed-in creator (course flow G1, D-054). A course is a product with
// type "course"; as with products, the `storeId` filter of `requireCreator()` IS the access check,
// and the type filter keeps the course editor from writing a digital product.

/** Saves the Basic and Pricing steps. The slug follows the title until the course is published. */
export async function updateCourseDetails(storeId: string, id: string, input: CourseDetailsInput): Promise<SaveProductResult> {
  const { products } = await collections();
  const filter = { _id: id, storeId, type: "course" as const };
  const current = await products.findOne(filter, { projection: { status: 1, slug: 1 } });
  if (!current) return "not_found";

  return saveWithSlug(filter, current, input.title, {
    title: input.title,
    description: input.description,
    descriptionDoc: input.descriptionDoc,
    coverUrl: input.coverUrl,
    priceCents: input.priceCents,
    salePriceCents: input.salePriceCents,
    course: input.course,
    updatedAt: new Date(),
  });
}
