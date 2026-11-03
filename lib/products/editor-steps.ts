// The product editor's steps (D-048): Details, then Checkout form, then Publish, one at a time like
// Stan's editor. Pure helpers, shared by the editor and its tests.

export const PRODUCT_STEPS = ["details", "checkout", "publish"] as const;
export type ProductStep = (typeof PRODUCT_STEPS)[number];

export const PRODUCT_STEP_LABELS: Record<ProductStep, string> = {
  details: "Details",
  checkout: "Checkout form",
  publish: "Publish",
};

/** For narrow screens, where all three steps sit side by side. */
export const PRODUCT_STEP_SHORT_LABELS: Record<ProductStep, string> = {
  details: "Details",
  checkout: "Checkout",
  publish: "Publish",
};

const FIELD_STEP: Record<string, ProductStep> = {
  title: "details",
  description: "details",
  descriptionDoc: "details",
  coverUrl: "details",
  externalUrl: "details",
  price: "details",
  salePrice: "details",
  buttonText: "details",
  headline: "checkout",
  questions: "checkout",
  thankYou: "publish",
  redirectUrl: "publish",
  emailSubject: "publish",
  emailBody: "publish",
  downloadLimit: "publish",
};

/** The step that holds a form field, so a failed save can open it. */
export function stepOfField(field: string | undefined): ProductStep | null {
  if (!field) return null;
  if (field.startsWith("question-")) return "checkout";
  return FIELD_STEP[field] ?? null;
}

export const nextStep = (step: ProductStep): ProductStep | null => PRODUCT_STEPS[PRODUCT_STEPS.indexOf(step) + 1] ?? null;
export const previousStep = (step: ProductStep): ProductStep | null => PRODUCT_STEPS[PRODUCT_STEPS.indexOf(step) - 1] ?? null;

/** What the Details step still needs, as the creator would fix it. */
export function detailsMissing(input: { title: string; priceValid: boolean; hasDelivery: boolean }): string[] {
  const missing: string[] = [];
  if (!input.title.trim()) missing.push("Add a title.");
  if (!input.priceValid) missing.push("Enter a valid price (0 for free).");
  if (!input.hasDelivery) missing.push("Add a link or a file to deliver.");
  return missing;
}

/**
 * Which steps show a check in the stepper: Details when nothing is missing, Checkout once the
 * creator has gone past it (name and email are always asked, so there is nothing to fill), and
 * Publish when the product is published.
 */
export function stepsDone(input: { detailsOk: boolean; furthest: ProductStep; published: boolean }): Record<ProductStep, boolean> {
  return {
    details: input.detailsOk,
    checkout: input.detailsOk && PRODUCT_STEPS.indexOf(input.furthest) >= PRODUCT_STEPS.indexOf("publish"),
    publish: input.published,
  };
}
