// Drip (D-056): with drip on, each module opens a set number of days after the student enrolls
// (founder choice: days after purchase, each student on their own schedule). With drip off, every
// lesson is open at once. Pure, client-safe, and the one place this rule lives (the student view
// in G4 uses it too).

const DAY_MS = 24 * 60 * 60 * 1000;

export const DRIP_DAYS_MAX = 365;

/** The day a module opens (0 = right away) for this course's release setting. */
export function unlockDay(drip: boolean, dripDays: number | null): number {
  return drip ? Math.max(0, dripDays ?? 0) : 0;
}

/** When a module opens for a student who enrolled at `enrolledAt`. */
export function unlocksAt(drip: boolean, dripDays: number | null, enrolledAt: Date): Date {
  return new Date(enrolledAt.getTime() + unlockDay(drip, dripDays) * DAY_MS);
}

/** True when the module is open for that student at `now`. */
export function isUnlocked(drip: boolean, dripDays: number | null, enrolledAt: Date, now: Date): boolean {
  return now.getTime() >= unlocksAt(drip, dripDays, enrolledAt).getTime();
}

/** "Opens right away" or "Opens on day 7". */
export function unlockLabel(drip: boolean, dripDays: number | null): string {
  const day = unlockDay(drip, dripDays);
  return day === 0 ? "Opens right away" : `Opens ${day} ${day === 1 ? "day" : "days"} after purchase`;
}
