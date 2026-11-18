import { beforeEach, describe, expect, it, vi } from "vitest";

// Coaching call reminders (D-085): which reminders a call gets, the reminder email, and that
// scheduling never throws inside the paid-order path.

const inngestMock = vi.hoisted(() => ({ send: vi.fn(), enabled: true }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: inngestMock.send, createFunction: vi.fn(() => ({})) },
  inngestEnabled: () => inngestMock.enabled,
}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn() }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: () => false }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" } }));
vi.mock("@/lib/logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { CALL_CONFIRMED_EVENT, reminderPlan, scheduleCallReminders } from "@/lib/coaching/reminders";
import { renderCallReminder } from "@/lib/email/templates";

beforeEach(() => {
  vi.clearAllMocks();
  inngestMock.enabled = true;
});

const start = new Date("2026-11-23T04:30:00Z");

describe("reminderPlan", () => {
  it("sends both reminders for a call more than a day away", () => {
    expect(reminderPlan(start, new Date("2026-11-20T00:00:00Z")).map((item) => [item.kind, item.sendAt.toISOString()])).toEqual([
      ["call-reminder-24h", "2026-11-22T04:30:00.000Z"],
      ["call-reminder-1h", "2026-11-23T03:30:00.000Z"],
    ]);
  });

  it("skips reminders whose time has passed", () => {
    expect(reminderPlan(start, new Date("2026-11-23T00:00:00Z")).map((item) => item.kind)).toEqual(["call-reminder-1h"]);
    expect(reminderPlan(start, new Date("2026-11-23T04:00:00Z"))).toEqual([]);
  });
});

describe("scheduleCallReminders", () => {
  it("sends one event per order, with the order id as the idempotency key", async () => {
    await scheduleCallReminders("order-1");
    expect(inngestMock.send).toHaveBeenCalledWith({ id: "call-confirmed-order-1", name: CALL_CONFIRMED_EVENT, data: { orderId: "order-1" } });
  });

  it("does nothing without Inngest, and never throws when sending fails", async () => {
    inngestMock.enabled = false;
    await scheduleCallReminders("order-1");
    expect(inngestMock.send).not.toHaveBeenCalled();
    inngestMock.enabled = true;
    inngestMock.send.mockRejectedValueOnce(new Error("inngest down"));
    await expect(scheduleCallReminders("order-1")).resolves.toBeUndefined();
  });
});

describe("reminder email", () => {
  const base = { storeName: "Maya's Studio", customerName: "Ravi", productTitle: "Portfolio review", lead: "in 1 hour", when: "Monday 10:00 (Asia/Kolkata)", meetingUrl: "https://zoom.us/j/1", libraryUrl: "http://localhost:3000/library/o1" };

  it("has the time, the join link, the booking link and the sender", () => {
    const email = renderCallReminder(base);
    expect(email.subject).toBe("Reminder: your call in 1 hour (Portfolio review)");
    expect(email.text).toContain("When: Monday 10:00 (Asia/Kolkata)");
    expect(email.text).toContain("https://zoom.us/j/1");
    expect(email.text).toContain("http://localhost:3000/library/o1");
    expect(email.text).toContain("Sent for Maya's Studio through Pickstall");
  });

  it("says the coach sends the link when there is none, and escapes HTML", () => {
    const email = renderCallReminder({ ...base, meetingUrl: null, customerName: "<img src=x>" });
    expect(email.text).toContain("Maya's Studio will email you the meeting link.");
    expect(email.html).not.toContain("<img src=x>");
  });
});
