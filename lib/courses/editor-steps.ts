// The course editor's steps (course flow, D-054): Basic, Pricing, Curriculum, Publish, one at a
// time like the product editor (D-048). Pure helpers, shared by the editor and its tests.

export const COURSE_STEPS = ["basic", "pricing", "curriculum", "publish"] as const;
export type CourseStep = (typeof COURSE_STEPS)[number];

export const COURSE_STEP_LABELS: Record<CourseStep, string> = {
  basic: "Basic info",
  pricing: "Pricing",
  curriculum: "Curriculum",
  publish: "Publish",
};

/** For narrow screens, where all four steps sit side by side. */
export const COURSE_STEP_SHORT_LABELS: Record<CourseStep, string> = {
  basic: "Basic",
  pricing: "Price",
  curriculum: "Lessons",
  publish: "Publish",
};

const FIELD_STEP: Record<string, CourseStep> = {
  title: "basic",
  descriptionDoc: "basic",
  coverUrl: "basic",
  category: "basic",
  tags: "basic",
  pricing: "pricing",
  price: "pricing",
  salePrice: "pricing",
  access: "pricing",
  accessDays: "pricing",
};

/** The step that holds a form field, so a failed save can open it. */
export function courseStepOfField(field: string | undefined): CourseStep | null {
  return field ? (FIELD_STEP[field] ?? null) : null;
}

export const nextCourseStep = (step: CourseStep): CourseStep | null => COURSE_STEPS[COURSE_STEPS.indexOf(step) + 1] ?? null;
export const previousCourseStep = (step: CourseStep): CourseStep | null => COURSE_STEPS[COURSE_STEPS.indexOf(step) - 1] ?? null;

/** What the Basic step still needs, as the creator would fix it. */
export function basicsMissing(input: { title: string; category: string }): string[] {
  const missing: string[] = [];
  if (!input.title.trim()) missing.push("Add a title.");
  if (!input.category) missing.push("Pick a category.");
  return missing;
}

/** What the Pricing step still needs. A free course needs nothing; a paid one a valid price above 0. */
export function pricingMissing(input: { pricing: "paid" | "free"; priceCents: number | null; access: "lifetime" | "days"; accessDays: string }): string[] {
  const missing: string[] = [];
  if (input.pricing === "paid" && !(input.priceCents !== null && input.priceCents > 0)) missing.push("Enter a price above 0, or pick Free.");
  if (input.access === "days" && !/^\d{1,4}$/.test(input.accessDays.trim())) missing.push("Enter how many days buyers keep access, or pick Lifetime.");
  return missing;
}
