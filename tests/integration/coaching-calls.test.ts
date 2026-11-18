import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Coaching calls, part K5 (D-086) on a real MongoDB: the calls list and cancel stay inside one store,
// cancelling frees the time and stops reminders, a full refund (from anywhere) cancels the call, and
// the buyer's cancellation email goes out once.

const mail = vi.hoisted(() => ({ emails: [] as { to: string; subject: string; text: string }[] }));
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async (email: { to: string; subject: string; text: string }) => {
    mail.emails.push(email);
  }),
}));
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: (task: () => unknown) => void Promise.resolve().then(task) };
});

import { holdSlot } from "@/lib/coaching/bookings";
import { cancelBooking, findOrderCall, listUpcomingCalls, sendCallCancelledEmail } from "@/lib/coaching/calls";
import { sendCallReminder } from "@/lib/coaching/reminders";
import { defaultCoachingSettings } from "@/lib/coaching/settings";
import { collections, type BookingDoc, type ProductDoc, type StoreDoc } from "@/lib/db/collections";
import { signMockBody } from "@/lib/payments/mock";
import { handleWebhookRequest } from "@/lib/payments/process";

import { seedOrder, seedProduct, seedStore } from "./fixtures";

beforeEach(() => {
  mail.emails.length = 0;
});

let counter = 0;
/** A new call slot each time, so tests never share a time. */
function nextSlot() {
  counter += 1;
  const start = new Date(Date.UTC(2032, 0, counter, 4, 30));
  return { start, end: new Date(start.getTime() + 30 * 60_000) };
}

async function setup() {
  const store = await seedStore({ name: "Maya's Studio" });
  const product = await seedProduct(store._id, { type: "coaching", title: "Portfolio review", coaching: { ...defaultCoachingSettings(), timeZone: "Asia/Kolkata", meetingUrl: null } });
  return { store, product };
}

async function bookCall(store: StoreDoc, product: ProductDoc, status: BookingDoc["status"] = "confirmed") {
  const { start, end } = nextSlot();
  const order = await seedOrder(product, { buyerEmail: `b-${randomUUID().slice(0, 6)}@example.com`, booking: { start, end, buyerTimeZone: null } });
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
    buyerTimeZone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { order, start, end };
}

describe("calls list", () => {
  it("lists this store's upcoming and conflict calls, soonest first, and never another store's", async () => {
    const a = await setup();
    const b = await setup();
    const first = await bookCall(a.store, a.product);
    const conflict = await bookCall(a.store, a.product, "conflict");
    await bookCall(a.store, a.product, "cancelled");
    await bookCall(b.store, b.product);

    const calls = await listUpcomingCalls(a.store._id, new Date("2031-12-01T00:00:00Z"));
    expect(calls.map((call) => call.orderId)).toEqual([first.order._id, conflict.order._id]);
    expect(calls[0]).toMatchObject({ buyerName: "Buyer", productTitle: "Portfolio review", timeZone: "Asia/Kolkata", status: "confirmed" });
    expect(await findOrderCall(b.store._id, first.order._id)).toBeNull();
  });
});

describe("cancelling a call", () => {
  it("only works for the store that sold it, frees the time and stops reminders", async () => {
    const a = await setup();
    const b = await setup();
    const call = await bookCall(a.store, a.product);

    expect(await cancelBooking(b.store._id, call.order._id)).toBe(false);
    expect((await findOrderCall(a.store._id, call.order._id))?.status).toBe("confirmed");

    expect(await cancelBooking(a.store._id, call.order._id)).toBe(true);
    expect(await cancelBooking(a.store._id, call.order._id)).toBe(false);
    expect((await findOrderCall(a.store._id, call.order._id))?.status).toBe("cancelled");

    // The time is free again.
    const other = await seedOrder(a.product, { status: "pending", paidAt: null });
    expect(await holdSlot({ storeId: a.store._id, productId: a.product._id, orderId: other._id, start: call.start, end: call.end, buyerTimeZone: null })).toBe("held");
    // No reminder for a cancelled call.
    expect(await sendCallReminder(call.order._id, "call-reminder-1h", call.start.toISOString(), new Date(call.start.getTime() - 60 * 60_000))).toBe("skipped");
  });

  it("emails the buyer once", async () => {
    const a = await setup();
    const call = await bookCall(a.store, a.product);
    await cancelBooking(a.store._id, call.order._id);
    expect(await sendCallCancelledEmail(call.order._id, true)).toBe("sent");
    expect(await sendCallCancelledEmail(call.order._id, true)).toBe("skipped");
    expect(mail.emails).toHaveLength(1);
    expect(mail.emails[0]).toMatchObject({ to: call.order.buyerEmail, subject: "Your call was cancelled: Portfolio review" });
    expect(mail.emails[0]?.text).toContain("full refund");
  });

  it("is cancelled by a full refund, wherever it was made", async () => {
    const a = await setup();
    const call = await bookCall(a.store, a.product);
    const { orders } = await collections();
    await orders.updateOne({ _id: call.order._id }, { $set: { providerPaymentId: `mockpay_${call.order._id}` } });
    const body = JSON.stringify({ id: `evt_${randomUUID()}`, type: "payment.refunded", orderId: call.order._id });
    expect((await handleWebhookRequest("mock", body, signMockBody(body))).status).toBe(200);
    expect((await orders.findOne({ _id: call.order._id }))?.status).toBe("refunded");
    expect((await findOrderCall(a.store._id, call.order._id))?.status).toBe("cancelled");
  });
});
