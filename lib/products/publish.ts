import { availabilityProblems } from "@/lib/coaching/settings";
import type { ProductDoc } from "@/lib/db/collections";
import { payableCents, type Priced } from "@/lib/products/pricing";

export type PublishCheck = { ok: true } | { ok: false; problems: string[] };

type Publishable = Pick<ProductDoc, "title" | "priceCents" | "salePriceCents" | "externalUrl" | "deliveryType" | "fileId"> & {
  type?: ProductDoc["type"];
  /** For a course: how many lessons have something for students (a video, notes, a file or a link). */
  courseLessons?: number;
  /** For a coaching call: its settings (D-081). */
  coaching?: ProductDoc["coaching"];
};


/**
 * Whether paid products may be published: the creator's Stripe account must be connected, or we
 * are in development where the MockProvider stands in (CLAUDE.md 7). In production only a
 * connected Stripe account counts.
 */
export function paymentsReady(store: { stripeChargesEnabled: boolean }, nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return store.stripeChargesEnabled || nodeEnv !== "production";
}

/** True when buyers can pay anything for this product. */
export function isPaid(product: Priced): boolean {
  return payableCents(product) > 0;
}

/** Something to deliver for the chosen delivery type (D-050): an uploaded file, or a link. */
export function hasDelivery(product: Pick<ProductDoc, "externalUrl" | "deliveryType" | "fileId">): boolean {
  return product.deliveryType === "file" ? Boolean(product.fileId) : Boolean(product.externalUrl);
}

/**
 * What still stops a product from being published, in the order the editor shows them (D-048).
 * Pure, so the editor's Publish step lists exactly what the server will check.
 */
export function publishProblems(product: Publishable, paymentsOk: boolean): string[] {
  const problems: string[] = [];
  if (!product.title.trim()) problems.push("Add a title.");
  // A course delivers its lessons (D-056): at least one must have something for students.
  if (product.type === "course") {
    if (!(product.courseLessons && product.courseLessons > 0)) problems.push("Add at least one lesson with a video, notes or a file.");
  } else if (product.type === "coaching") {
    // A coaching call delivers a booked time (D-081): it needs a time zone and valid weekly hours.
    const coaching = product.coaching;
    if (!coaching?.timeZone) problems.push("Pick your time zone.");
    if (coaching) problems.push(...availabilityProblems(coaching.weekly, coaching.durationMinutes));
  } else if (!hasDelivery(product)) problems.push("Add a link or a file to deliver.");
  if (isPaid(product) && !paymentsOk) problems.push("Connect payments to publish a paid product.");
  return problems;
}

/** Publish rules (PRD F3): a title, something to deliver, a valid price and payments for paid products. */
export function checkPublish(product: Publishable, store: { stripeChargesEnabled: boolean }, nodeEnv?: string): PublishCheck {
  const problems = publishProblems(product, paymentsReady(store, nodeEnv));
  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}
