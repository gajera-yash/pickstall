// Course settings shared by the editor, the server and the store (PRD F3 Course, founder spec
// 2026-11-04). Client-safe: no database or server code here.

/** The fixed category list a creator picks one from (step 1). */
export const COURSE_CATEGORIES = [
  "design",
  "development",
  "marketing",
  "business",
  "photo-video",
  "music",
  "health-fitness",
  "personal-growth",
  "other",
] as const;
export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

export const COURSE_CATEGORY_LABELS: Record<CourseCategory, string> = {
  design: "Design",
  development: "Development",
  marketing: "Marketing",
  business: "Business",
  "photo-video": "Photo & video",
  music: "Music",
  "health-fitness": "Health & fitness",
  "personal-growth": "Personal growth",
  other: "Other",
};

export const COURSE_LIMITS = {
  tagsMax: 5,
  tag: 24,
  /** Access period in days when it is not lifetime (10 years at most). */
  accessDaysMax: 3650,
} as const;

/** "Lifetime access" or "365 days of access". */
export function accessLabel(accessDays: number | null): string {
  if (accessDays === null) return "Lifetime access";
  return `${accessDays} ${accessDays === 1 ? "day" : "days"} of access`;
}
