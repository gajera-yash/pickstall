import { describe, expect, it } from "vitest";

import { availableSlots, findSlot, slotsByDay, type SlotSettings } from "@/lib/coaching/slots";
import { addDays, isoWeekday, localDateOf, offsetMinutes, zonedTimeToUtc } from "@/lib/coaching/time-zones";

// Coaching calls, part K2 (D-082): time zone arithmetic and the slot engine.

const iso = (slots: { start: Date }[]) => slots.map((slot) => slot.start.toISOString());

// Monday 16 Nov 2026, 00:00 UTC (05:30 in India).
const MONDAY = new Date("2026-11-16T00:00:00Z");

const india: SlotSettings = {
  durationMinutes: 30,
  timeZone: "Asia/Kolkata",
  weekly: [{ day: 1, start: "09:00", end: "11:00" }],
  bufferMinutes: 0,
  minNoticeHours: 0,
  bookingWindowDays: 7,
};

describe("time zones", () => {
  it("knows the offset, including daylight saving", () => {
    expect(offsetMinutes(MONDAY, "Asia/Kolkata")).toBe(330);
    expect(offsetMinutes(new Date("2026-07-01T12:00:00Z"), "America/New_York")).toBe(-240);
    expect(offsetMinutes(new Date("2026-01-01T12:00:00Z"), "America/New_York")).toBe(-300);
    expect(offsetMinutes(MONDAY, "UTC")).toBe(0);
  });

  it("turns a wall time into the right instant", () => {
    expect(zonedTimeToUtc({ year: 2026, month: 11, day: 16 }, 9 * 60, "Asia/Kolkata")?.toISOString()).toBe("2026-11-16T03:30:00.000Z");
    expect(zonedTimeToUtc({ year: 2026, month: 7, day: 1 }, 9 * 60, "America/New_York")?.toISOString()).toBe("2026-07-01T13:00:00.000Z");
  });

  it("returns null for a time skipped by daylight saving, and the first of a doubled time", () => {
    expect(zonedTimeToUtc({ year: 2026, month: 3, day: 8 }, 2 * 60 + 30, "America/New_York")).toBeNull();
    expect(zonedTimeToUtc({ year: 2026, month: 11, day: 1 }, 60 + 30, "America/New_York")?.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("counts calendar days and ISO weekdays", () => {
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
    expect(isoWeekday({ year: 2026, month: 11, day: 16 })).toBe(1);
    expect(isoWeekday({ year: 2026, month: 11, day: 22 })).toBe(7);
    expect(localDateOf(MONDAY, "America/Los_Angeles")).toEqual({ year: 2026, month: 11, day: 15 });
  });
});

describe("availableSlots", () => {
  it("lays calls back to back inside the weekly hours, in the coach's time zone", () => {
    expect(iso(availableSlots(india, [], MONDAY))).toEqual(["2026-11-16T03:30:00.000Z", "2026-11-16T04:00:00.000Z", "2026-11-16T04:30:00.000Z", "2026-11-16T05:00:00.000Z"]);
    const [first] = availableSlots(india, [], MONDAY);
    expect(first && first.end.getTime() - first.start.getTime()).toBe(30 * 60_000);
  });

  it("keeps the break between calls, and a call must end by the end of the range", () => {
    expect(iso(availableSlots({ ...india, bufferMinutes: 10 }, [], MONDAY))).toEqual(["2026-11-16T03:30:00.000Z", "2026-11-16T04:10:00.000Z", "2026-11-16T04:50:00.000Z"]);
  });

  it("drops slots that clash with a busy time, break included", () => {
    const busy = [{ start: new Date("2026-11-16T04:00:00Z"), end: new Date("2026-11-16T04:30:00Z") }];
    expect(iso(availableSlots(india, busy, MONDAY))).toEqual(["2026-11-16T03:30:00.000Z", "2026-11-16T04:30:00.000Z", "2026-11-16T05:00:00.000Z"]);
    expect(iso(availableSlots({ ...india, bufferMinutes: 10 }, busy, MONDAY))).toEqual(["2026-11-16T04:50:00.000Z"]);
  });

  it("applies the minimum notice and the booking window", () => {
    const now = new Date("2026-11-16T03:45:00Z"); // 09:15 in India
    // Today's 09:30, 10:00 and 10:30, and next Monday's 09:00, which is just inside 7 days.
    expect(iso(availableSlots(india, [], now))).toEqual(["2026-11-16T04:00:00.000Z", "2026-11-16T04:30:00.000Z", "2026-11-16T05:00:00.000Z", "2026-11-23T03:30:00.000Z"]);
    expect(iso(availableSlots({ ...india, minNoticeHours: 1 }, [], now))).toEqual(["2026-11-16T05:00:00.000Z", "2026-11-23T03:30:00.000Z"]);
    expect(availableSlots({ ...india, bookingWindowDays: 7 }, [], new Date("2026-11-16T06:00:00Z")).map((slot) => slot.start.toISOString())).toEqual([
      "2026-11-23T03:30:00.000Z",
      "2026-11-23T04:00:00.000Z",
      "2026-11-23T04:30:00.000Z",
      "2026-11-23T05:00:00.000Z",
    ]);
  });

  it("skips the hour lost when clocks go forward and keeps real 30-minute calls", () => {
    const sunday: SlotSettings = { ...india, timeZone: "America/New_York", weekly: [{ day: 7, start: "01:00", end: "04:00" }], bookingWindowDays: 2 };
    expect(iso(availableSlots(sunday, [], new Date("2026-03-07T00:00:00Z")))).toEqual([
      "2026-03-08T06:00:00.000Z", // 01:00 EST
      "2026-03-08T06:30:00.000Z", // 01:30 EST
      "2026-03-08T07:00:00.000Z", // 03:00 EDT (02:00 and 02:30 do not exist)
      "2026-03-08T07:30:00.000Z", // 03:30 EDT
    ]);
  });

  it("uses the first of the doubled hour when clocks go back", () => {
    const sunday: SlotSettings = { ...india, timeZone: "America/New_York", weekly: [{ day: 7, start: "01:00", end: "02:00" }], bookingWindowDays: 2 };
    expect(iso(availableSlots(sunday, [], new Date("2026-10-31T00:00:00Z")))).toEqual(["2026-11-01T05:00:00.000Z", "2026-11-01T05:30:00.000Z"]);
  });

  it("offers nothing without a time zone or with no open days", () => {
    expect(availableSlots({ ...india, timeZone: null }, [], MONDAY)).toEqual([]);
    expect(availableSlots({ ...india, weekly: [] }, [], MONDAY)).toEqual([]);
  });

  it("covers the whole booking window for every open day", () => {
    const weekdays: SlotSettings = { ...india, weekly: [1, 2, 3, 4, 5].map((day) => ({ day, start: "09:00", end: "17:00" })), bookingWindowDays: 90 };
    const slots = availableSlots(weekdays, [], MONDAY);
    // 16 calls a day on 65 weekdays: the 90 days end early on a Sunday, so exactly 13 weeks.
    expect(slots.length).toBe(65 * 16);
    expect(slots.every((slot, index) => index === 0 || slot.start > (slots[index - 1] as { start: Date }).start)).toBe(true);
  });
});

describe("findSlot (the server's check before holding a time)", () => {
  it("accepts only a start the engine offers", () => {
    expect(findSlot(india, [], MONDAY, new Date("2026-11-16T04:00:00Z"))?.end.toISOString()).toBe("2026-11-16T04:30:00.000Z");
    expect(findSlot(india, [], MONDAY, new Date("2026-11-16T04:10:00Z"))).toBeNull();
    expect(findSlot(india, [], MONDAY, new Date("invalid"))).toBeNull();
    expect(findSlot(india, [{ start: new Date("2026-11-16T04:00:00Z"), end: new Date("2026-11-16T04:30:00Z") }], MONDAY, new Date("2026-11-16T04:00:00Z"))).toBeNull();
  });
});

describe("slotsByDay", () => {
  it("groups by the buyer's own calendar day", () => {
    const days = slotsByDay(availableSlots(india, [], MONDAY), "America/Los_Angeles");
    // 09:00 to 11:00 in India is Sunday evening in Los Angeles.
    expect(days.map((day) => [day.key, day.slots.length])).toEqual([["2026-11-15", 4]]);
    expect(slotsByDay(availableSlots(india, [], MONDAY), "Asia/Kolkata").map((day) => day.key)).toEqual(["2026-11-16"]);
  });
});
