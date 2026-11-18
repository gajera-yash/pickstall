// The coaching editor's steps (D-081): Details, Availability, Price & publish, one at a time like
// the product and course editors. Pure helpers, shared by the editor and its tests.

export const COACHING_STEPS = ["details", "availability", "publish"] as const;
export type CoachingStep = (typeof COACHING_STEPS)[number];

export const COACHING_STEP_LABELS: Record<CoachingStep, string> = {
  details: "Details",
  availability: "Availability",
  publish: "Price & publish",
};

/** For narrow screens, where all three steps sit side by side. */
export const COACHING_STEP_SHORT_LABELS: Record<CoachingStep, string> = {
  details: "Details",
  availability: "Hours",
  publish: "Publish",
};

const FIELD_STEP: Record<string, CoachingStep> = {
  title: "details",
  descriptionDoc: "details",
  coverUrl: "details",
  durationMinutes: "details",
  timeZone: "availability",
  weekly: "availability",
  bufferMinutes: "availability",
  minNoticeHours: "availability",
  bookingWindowDays: "availability",
  meeting: "availability",
  meetingUrl: "availability",
  pricing: "publish",
  price: "publish",
  salePrice: "publish",
};

/** The step that holds a form field, so a failed save can open it. */
export function coachingStepOfField(field: string | undefined): CoachingStep | null {
  return field ? (FIELD_STEP[field] ?? null) : null;
}

export const nextCoachingStep = (step: CoachingStep): CoachingStep | null => COACHING_STEPS[COACHING_STEPS.indexOf(step) + 1] ?? null;
export const previousCoachingStep = (step: CoachingStep): CoachingStep | null => COACHING_STEPS[COACHING_STEPS.indexOf(step) - 1] ?? null;
