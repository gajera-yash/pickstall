// Coaching call settings shared by the editor, the server and (later) the booking page (D-081).
// Client-safe and pure: no database or server code here.

import type { CoachingSettingsDoc, CoachingWindowDoc } from "@/lib/db/collections";

export const COACHING_DURATIONS = [15, 30, 45, 60, 90] as const;
export const COACHING_BUFFERS = [0, 5, 10, 15, 30] as const;
export const COACHING_NOTICE_HOURS = [0, 1, 2, 4, 12, 24, 48] as const;
export const COACHING_WINDOW_DAYS = [7, 14, 30, 60, 90] as const;

export const COACHING_LIMITS = {
  windowsPerDay: 3,
  meetingUrl: 500,
} as const;

/** ISO weekdays, Monday first. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const WEEKDAY_LABELS: Record<number, string> = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday" };

/** Settings for a new coaching call: 30 minutes, weekdays 9:00 to 17:00, the link sent later. */
export function defaultCoachingSettings(): CoachingSettingsDoc {
  return {
    durationMinutes: 30,
    timeZone: null,
    weekly: [1, 2, 3, 4, 5].map((day) => ({ day, start: "09:00", end: "17:00" })),
    bufferMinutes: 0,
    minNoticeHours: 12,
    bookingWindowDays: 30,
    meetingUrl: null,
  };
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes after midnight for "HH:MM" ("24:00" is the end of the day), or null when malformed. */
export function minutesOf(value: string): number | null {
  if (value === "24:00") return 24 * 60;
  const match = TIME.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** True for a time zone this runtime knows, for example "Asia/Kolkata" or "UTC". */
export function isValidTimeZone(value: string): boolean {
  if (!value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * What is wrong with the weekly hours, as the creator would fix it, or an empty list. Each range
 * runs forward on one day in 5-minute steps, fits at least one call, and does not overlap another
 * range that day; a day has at most 3 ranges, and at least one day must be open.
 */
export function availabilityProblems(weekly: readonly CoachingWindowDoc[], durationMinutes: number): string[] {
  const problems = new Set<string>();
  if (weekly.length === 0) problems.add("Open at least one day for calls.");
  for (const day of WEEKDAYS) {
    const label = WEEKDAY_LABELS[day];
    const ranges = weekly
      .filter((window) => window.day === day)
      .map((window) => ({ start: minutesOf(window.start), end: minutesOf(window.end) }));
    if (ranges.length > COACHING_LIMITS.windowsPerDay) problems.add(`${label}: use up to ${COACHING_LIMITS.windowsPerDay} time ranges.`);
    for (const range of ranges) {
      if (range.start === null || range.end === null || range.start === 24 * 60) problems.add(`${label}: enter times like 09:00.`);
      else if (range.start % 5 !== 0 || range.end % 5 !== 0) problems.add(`${label}: use times in 5-minute steps.`);
      else if (range.end <= range.start) problems.add(`${label}: the end time must be after the start time.`);
      else if (range.end - range.start < durationMinutes) problems.add(`${label}: each time range must fit at least one ${durationMinutes}-minute call.`);
    }
    const valid = ranges.filter((range): range is { start: number; end: number } => range.start !== null && range.end !== null).sort((a, b) => a.start - b.start);
    for (let index = 1; index < valid.length; index++) {
      if ((valid[index] as { start: number }).start < (valid[index - 1] as { end: number }).end) problems.add(`${label}: time ranges must not overlap.`);
    }
  }
  if (weekly.some((window) => !WEEKDAYS.includes(window.day as (typeof WEEKDAYS)[number]))) problems.add("Pick days from the list.");
  return [...problems];
}

/** "30 min" or "1 h 30 min". */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** For the preview: how many days are open and how many hours a week, for example "5 days a week, 40 hours". */
export function weeklySummary(weekly: readonly CoachingWindowDoc[]): string {
  const days = new Set(weekly.map((window) => window.day)).size;
  const minutes = weekly.reduce((sum, window) => {
    const start = minutesOf(window.start);
    const end = minutesOf(window.end);
    return start !== null && end !== null && end > start ? sum + (end - start) : sum;
  }, 0);
  if (days === 0) return "No days open yet";
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${days} ${days === 1 ? "day" : "days"} a week, ${hours} ${hours === 1 ? "hour" : "hours"}`;
}
