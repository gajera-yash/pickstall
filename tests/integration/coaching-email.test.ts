import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Coaching calls, part K4 (D-084) on a real MongoDB: the buyer's email carries the booked time, the
// meeting link and a calendar file; the library shows the call, and the link only to the buyer of a
// confirmed, paid booking.

const mail = vi.hoisted(() => ({ emails: [] as { to: string; text: string; attachments?: { filename: string; content: string }[] }[] }));
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async (email: { to: string; text: string; attachments?: { filename: string; content: string }[] }) => {
    mail.emails.push(email);
  }),
}));

import { collections, type BookingDoc, type OrderDoc } from "@/lib/db/collections";
import { defaultCoachingSettings } from "@/lib/coaching/settings";
import { findPurchase, listPurchases } from "@/lib/library/queries";
import { sendOrderConfirmation } from "@/lib/orders/confirmation";

import { seedOrder, seedProduct, seedStore } from "./fixtures";

beforeEach(() => {
  mail.emails.length = 0;
});

const start = new Date("2031-05-05T04:30:00Z");
const end = new Date("2031-05-05T05:00:00Z");

async function bookedOrder(status: BookingDoc["status"], orderOverrides: Partial<OrderDoc> = {}, meetingUrl: string | null = "https://zoom.us/j/999") {
  const store = await seedStore({ name: "Maya's Studio" });
  const product = await seedProduct(store._id, { type: "coaching", title: "Portfolio review", coaching: { ...defaultCoachingSettings(), timeZone: "Asia/Kolkata", meetingUrl } });
  const order = await seedOrder(product, { buyerEmail: `buyer-${randomUUID().slice(0, 6)}@example.com`, booking: { start, end, buyerTimeZone: "America/New_York" }, ...orderOverrides });
  const { bookings } = await collections();
  await bookings.insertOne({
    _id: randomUUID(),
    storeId: store._id,
    productId: product._id,
    orderId: order._id,
    start,
    end,
    status,
    activeSlot: status === "confirmed" ? `${store._id}|${start.toISOString()}` : null,
    holdExpiresAt: null,
    confirmedAt: status === "confirmed" ? new Date() : null,
    buyerTimeZone: "America/New_York",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { store, product, order };
}

describe("booking email", () => {
  it("has the time in the buyer's zone, the join link and a calendar file", async () => {
    const { order } = await bookedOrder("confirmed");
    expect(await sendOrderConfirmation(order._id)).toBe("sent");
    const email = mail.emails[0];
    expect(email?.text).toContain("Your call: Monday, May 5, 2031");
    expect(email?.text).toContain("(America/New York)");
    expect(email?.text).toContain("https://zoom.us/j/999");
    expect(email?.attachments?.[0]?.filename).toBe("call.ics");
    expect(email?.attachments?.[0]?.content).toContain("DTSTART:20310505T043000Z");
  });

  it("tells the buyer about a conflict and sends no calendar file", async () => {
    const { order } = await bookedOrder("conflict");
    expect(await sendOrderConfirmation(order._id)).toBe("sent");
    expect(mail.emails[0]?.text).toContain("was just taken");
    expect(mail.emails[0]?.attachments).toBeUndefined();
  });
});

describe("library call", () => {
  it("shows the call and the meeting link to the buyer of a confirmed booking", async () => {
    const { order } = await bookedOrder("confirmed");
    const purchase = await findPurchase(order.buyerEmail, order._id);
    expect(purchase?.kind).toBe("coaching");
    expect(purchase?.available).toBe(true);
    expect(purchase?.call).toMatchObject({ status: "confirmed", meetingUrl: "https://zoom.us/j/999", buyerTimeZone: "America/New_York", ended: false });
    expect((await listPurchases(order.buyerEmail))[0]?.call?.start.toISOString()).toBe(start.toISOString());
  });

  it("hides the meeting link after a refund or a conflict, and from anyone else", async () => {
    const refunded = await bookedOrder("confirmed", { status: "refunded" });
    expect((await findPurchase(refunded.order.buyerEmail, refunded.order._id))?.call?.meetingUrl).toBeNull();
    const conflict = await bookedOrder("conflict");
    expect((await findPurchase(conflict.order.buyerEmail, conflict.order._id))?.call?.meetingUrl).toBeNull();
    expect(await findPurchase("someone-else@example.com", conflict.order._id)).toBeNull();
  });
});
