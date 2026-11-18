import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Coaching call reminders (D-085) on a real MongoDB: a reminder goes out once, and never for a call
// that was refunded, cancelled, moved or is already over.

const mail = vi.hoisted(() => ({ emails: [] as { to: string; subject: string }[] }));
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async (email: { to: string; subject: string }) => {
    mail.emails.push(email);
  }),
}));

import { confirmedCallStart, sendCallReminder } from "@/lib/coaching/reminders";
import { defaultCoachingSettings } from "@/lib/coaching/settings";
import { collections, type BookingDoc, type OrderDoc } from "@/lib/db/collections";

import { seedOrder, seedProduct, seedStore } from "./fixtures";

beforeEach(() => {
  mail.emails.length = 0;
});

const start = new Date("2031-06-02T04:30:00Z");
const end = new Date("2031-06-02T05:00:00Z");
const before = new Date("2031-06-02T03:30:00Z");

async function call(status: BookingDoc["status"] = "confirmed", order: Partial<OrderDoc> = {}) {
  const store = await seedStore({ name: "Maya's Studio" });
  const product = await seedProduct(store._id, { type: "coaching", title: "Portfolio review", coaching: { ...defaultCoachingSettings(), timeZone: "Asia/Kolkata", meetingUrl: "https://zoom.us/j/1" } });
  const seeded = await seedOrder(product, { buyerEmail: `b-${randomUUID().slice(0, 6)}@example.com`, booking: { start, end, buyerTimeZone: null }, ...order });
  const { bookings } = await collections();
  await bookings.insertOne({ _id: randomUUID(), storeId: store._id, productId: product._id, orderId: seeded._id, start, end, status, activeSlot: null, holdExpiresAt: null, buyerTimeZone: null, createdAt: new Date(), updatedAt: new Date() });
  return seeded;
}

describe("call reminders", () => {
  it("sends the 1-hour reminder once", async () => {
    const order = await call();
    expect(await confirmedCallStart(order._id)).toBe(start.toISOString());
    expect(await sendCallReminder(order._id, "call-reminder-1h", start.toISOString(), before)).toBe("sent");
    expect(mail.emails[0]).toMatchObject({ to: order.buyerEmail, subject: "Reminder: your call in 1 hour (Portfolio review)" });
    expect(await sendCallReminder(order._id, "call-reminder-1h", start.toISOString(), before)).toBe("skipped");
    expect(mail.emails).toHaveLength(1);
    // The 24-hour reminder is its own email.
    expect(await sendCallReminder(order._id, "call-reminder-24h", start.toISOString(), new Date("2031-06-01T04:30:00Z"))).toBe("sent");
  });

  it("skips a refunded order, a booking that is not confirmed, a moved call and a call that is over", async () => {
    const refunded = await call("confirmed", { status: "refunded" });
    expect(await sendCallReminder(refunded._id, "call-reminder-1h", start.toISOString(), before)).toBe("skipped");
    const conflict = await call("conflict");
    expect(await sendCallReminder(conflict._id, "call-reminder-1h", start.toISOString(), before)).toBe("skipped");
    expect(await confirmedCallStart(conflict._id)).toBeNull();
    const moved = await call();
    expect(await sendCallReminder(moved._id, "call-reminder-1h", "2031-06-03T04:30:00.000Z", before)).toBe("skipped");
    expect(await sendCallReminder(moved._id, "call-reminder-1h", start.toISOString(), new Date("2031-06-02T06:00:00Z"))).toBe("skipped");
    expect(mail.emails).toHaveLength(0);
  });
});
