// The coaching slot engine (D-082): which call start times a buyer may pick. Pure and client-safe:
// the server recomputes the same slots before it holds one (K3), so a time sent by a browser is
// never trusted on its own.

import { minutesOf } from "@/lib/coaching/settings";
import { addDays, compareDates, dateKey, isoWeekday, localDateOf, zonedTimeToUtc } from "@/lib/coaching/time-zones";
import type { CoachingSettingsDoc } from "@/lib/db/collections";

export type Slot = { start: Date; end: Date };

/** A time the coach is already taken: a booked or held call (any of the store's coaching products). */
export type BusyTime = { start: Date; end: Date };

export type SlotSettings = Pick<CoachingSettingsDoc, "durationMinutes" | "timeZone" | "weekly" | "bufferMinutes" | "minNoticeHours" | "bookingWindowDays">;

/** Never return more than this many slots (90 days of 15-minute calls fits easily). */
export const MAX_SLOTS = 5000;

const MINUTE = 60_000;

/**
 * Every open call start between now plus the minimum notice and now plus the booking window.
 *
 * - Slots follow the weekly hours in the coach's time zone, one after another from the start of each
 *   range, each `durationMinutes` long with `bufferMinutes` of break before the next; a slot must
 *   end by the end of its range.
 * - A slot is dropped when it overlaps a busy time, with the break kept on both sides of it.
 * - Wall times that do not exist on a daylight-saving day are skipped; times that happen twice use
 *   the first.
 */
export function availableSlots(settings: SlotSettings, busy: readonly BusyTime[], now: Date): Slot[] {
  const timeZone = settings.timeZone;
  if (!timeZone) return [];
  const duration = settings.durationMinutes;
  const step = duration + settings.bufferMinutes;
  const buffer = settings.bufferMinutes * MINUTE;
  if (!(duration > 0)) return [];

  const earliest = now.getTime() + settings.minNoticeHours * 60 * MINUTE;
  const latest = now.getTime() + settings.bookingWindowDays * 24 * 60 * MINUTE;
  const blocked = busy.map((time) => ({ start: time.start.getTime() - buffer, end: time.end.getTime() + buffer }));

  const slots: Slot[] = [];
  const lastDay = localDateOf(new Date(latest), timeZone);
  for (let date = localDateOf(new Date(earliest), timeZone); compareDates(date, lastDay) <= 0; date = addDays(date, 1)) {
    const weekday = isoWeekday(date);
    const ranges = settings.weekly
      .filter((window) => window.day === weekday)
      .map((window) => ({ start: minutesOf(window.start), end: minutesOf(window.end) }))
      .filter((range): range is { start: number; end: number } => range.start !== null && range.end !== null && range.end > range.start)
      .sort((a, b) => a.start - b.start);

    for (const range of ranges) {
      for (let minute = range.start; minute + duration <= range.end; minute += step) {
        const start = zonedTimeToUtc(date, minute, timeZone);
        if (!start) continue;
        const startMs = start.getTime();
        const endMs = startMs + duration * MINUTE;
        if (startMs < earliest || startMs > latest) continue;
        if (blocked.some((time) => startMs < time.end && endMs > time.start)) continue;
        slots.push({ start, end: new Date(endMs) });
        if (slots.length >= MAX_SLOTS) return slots;
      }
    }
  }
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * The open slot that starts exactly at `start`, or null. The server calls this before it holds a
 * time for a buyer (K3), so only a start the engine itself offers can ever be booked.
 */
export function findSlot(settings: SlotSettings, busy: readonly BusyTime[], now: Date, start: Date): Slot | null {
  const wanted = start.getTime();
  if (!Number.isFinite(wanted)) return null;
  return availableSlots(settings, busy, now).find((slot) => slot.start.getTime() === wanted) ?? null;
}

export type SlotDay = { key: string; date: { year: number; month: number; day: number }; slots: Slot[] };

/** Slots grouped by calendar day in the buyer's time zone, for the booking page's day picker. */
export function slotsByDay(slots: readonly Slot[], viewerTimeZone: string): SlotDay[] {
  const days = new Map<string, SlotDay>();
  for (const slot of slots) {
    const date = localDateOf(slot.start, viewerTimeZone);
    const key = dateKey(date);
    const day = days.get(key) ?? { key, date, slots: [] };
    day.slots.push(slot);
    days.set(key, day);
  }
  return [...days.values()].sort((a, b) => a.key.localeCompare(b.key));
}
