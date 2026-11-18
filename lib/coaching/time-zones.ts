// Time zone arithmetic for coaching calls (D-082), built on Intl only (no date library). Pure and
// client-safe, so the booking page and the server compute the same times.

export type LocalDate = { year: number; month: number; day: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The wall-clock date and time of `instant` in `timeZone`. */
export function wallClock(instant: Date, timeZone: string): LocalDate & { minutes: number; seconds: number } {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  // Some engines write midnight as 24 even with h23.
  const hour = parts.hour === 24 ? 0 : (parts.hour ?? 0);
  return { year: parts.year ?? 1970, month: parts.month ?? 1, day: parts.day ?? 1, minutes: hour * 60 + (parts.minute ?? 0), seconds: parts.second ?? 0 };
}

/** Minutes `timeZone` is ahead of UTC at `instant` (330 for India, -240 for New York in summer). */
export function offsetMinutes(instant: Date, timeZone: string): number {
  const wall = wallClock(instant, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, 0, wall.minutes, wall.seconds);
  const whole = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asUtc - whole) / 60_000);
}

/**
 * The instant when the clocks in `timeZone` show `minutes` after midnight on `date`, or null when
 * that wall time does not exist there (skipped by a daylight-saving jump). When the clocks go back
 * and a time happens twice, the first one is used.
 */
export function zonedTimeToUtc(date: LocalDate, minutes: number, timeZone: string): Date | null {
  const wall = Date.UTC(date.year, date.month - 1, date.day, 0, minutes);
  // Two passes: the offset at a first guess, then at the result (they differ near a DST change).
  const first = wall - offsetMinutes(new Date(wall), timeZone) * 60_000;
  const second = wall - offsetMinutes(new Date(first), timeZone) * 60_000;
  // Of the candidates that really show the wanted wall time, the earlier one wins.
  const candidates = [...new Set([first, second])].sort((a, b) => a - b).filter((utc) => {
    const back = wallClock(new Date(utc), timeZone);
    return Date.UTC(back.year, back.month - 1, back.day, 0, back.minutes) === wall;
  });
  return candidates.length > 0 ? new Date(candidates[0] as number) : null;
}

/** The calendar date of `instant` in `timeZone`. */
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  const { year, month, day } = wallClock(instant, timeZone);
  return { year, month, day };
}

/** `date` plus `days` calendar days. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

/** ISO weekday of a calendar date: 1 Monday ... 7 Sunday. */
export function isoWeekday(date: LocalDate): number {
  const day = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** "2026-11-18": sortable, and used as a day key on the booking page. */
export function dateKey(date: LocalDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

/** Negative, zero or positive as `a` is before, the same day as, or after `b`. */
export function compareDates(a: LocalDate, b: LocalDate): number {
  return Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day);
}
