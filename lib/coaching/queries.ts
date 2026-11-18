import "server-only";

import { collections } from "@/lib/db/collections";
import type { CoachingDetailsInput } from "@/lib/coaching/schemas";
import { saveWithSlug, type SaveProductResult } from "@/lib/products/queries";

// Coaching writes for the signed-in creator (D-081). A coaching call is a product with type
// "coaching"; as with products, the `storeId` filter of `requireCreator()` IS the access check, and
// the type filter keeps the coaching editor from writing any other product.

/** Saves the coaching editor. The slug follows the title until the call is published. */
export async function updateCoachingDetails(storeId: string, id: string, input: CoachingDetailsInput): Promise<SaveProductResult> {
  const { products } = await collections();
  const filter = { _id: id, storeId, type: "coaching" as const, deletedAt: null };
  const current = await products.findOne(filter, { projection: { status: 1, slug: 1 } });
  if (!current) return "not_found";

  return saveWithSlug(filter, current, input.title, {
    title: input.title,
    description: input.description,
    descriptionDoc: input.descriptionDoc,
    coverUrl: input.coverUrl,
    priceCents: input.priceCents,
    salePriceCents: input.salePriceCents,
    coaching: input.coaching,
    updatedAt: new Date(),
  });
}
