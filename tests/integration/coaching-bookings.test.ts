import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

// Coaching bookings (D-083) on a real MongoDB: parallel holds of one time give one booking, holds of
// overlapping calls give one booking, expired holds give their time back, and only the verified
// payment path confirms a booking (a replay changes nothing).

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn(async () => undefined) }));
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: (task: () => unknown) => void Promise.resolve().then(task) };
});

import { busyTimesForStore, confirmBookingForOrder, holdSlot, releaseBookingForOrder } from "@/lib/coaching/bookings";
import { collections, type ProductDoc, type StoreDoc } from "@/lib/db/collections";
import { markOrderFailed } from "@/lib/orders/queries";
import { signMockBody } from "@/lib/payments/mock";
import { handleWebhookRequest } from "@/lib/payments/process";

import { seedOrder, seedProduct, seedStore } from "./fixtures";

let store: StoreDoc;
let other: StoreDoc;
let call: ProductDoc;

beforeAll(async () => {
  store = await seedStore();
  other = await seedStore();
  call = await seedProduct(store._id, { type: "coaching" });
});

const at = (iso: string) => new Date(iso);
const minutes = (start: Date, length: number) => new Date(start.getTime() + length * 60_000);

async function pendingOrder() {
  return seedOrder(call, { status: "pending", paidAt: null });
}

async function hold(start: Date, length = 30, now = new Date(), storeId = store._id) {
  const order = await pendingOrder();
  const result = await holdSlot({ storeId, productId: call._id, orderId: order._id, start, end: minutes(start, length), buyerTimeZone: "Asia/Kolkata" }, now);
  return { order, result };
}

async function bookingOf(orderId: string) {
  const { bookings } = await collections();
  return bookings.findOne({ orderId });
}

describe("holding a time", () => {
  it("gives a time to exactly one of several buyers at once", async () => {
    const start = at("2030-01-07T04:00:00Z");
    const results = await Promise.all(Array.from({ length: 6 }, () => hold(start)));
    expect(results.filter((item) => item.result === "held")).toHaveLength(1);
  });

  it("gives overlapping calls of different lengths to exactly one buyer", async () => {
    const results = await Promise.all([hold(at("2030-01-08T04:00:00Z"), 60), hold(at("2030-01-08T04:30:00Z"), 30), hold(at("2030-01-08T04:15:00Z"), 45)]);
    expect(results.filter((item) => item.result === "held")).toHaveLength(1);
    const released = await Promise.all(results.filter((item) => item.result === "taken").map((item) => bookingOf(item.order._id)));
    expect(released.every((booking) => booking === null || (booking.status === "released" && booking.activeSlot === null))).toBe(true);
  });

  it("lets a new buyer take a time whose hold ran out", async () => {
    const start = at("2030-01-09T04:00:00Z");
    const first = await hold(start, 30, new Date("2030-01-01T00:00:00Z"));
    expect(first.result).toBe("held");
    const second = await hold(start, 30, new Date("2030-01-01T02:00:00Z")); // 2 hours later, past the 65-minute hold
    expect(second.result).toBe("held");
    expect((await bookingOf(first.order._id))?.status).toBe("released");
  });

  it("keeps stores apart: another store may book the same moment", async () => {
    const start = at("2030-01-10T04:00:00Z");
    expect((await hold(start)).result).toBe("held");
    expect((await hold(start, 30, new Date(), other._id)).result).toBe("held");
  });
});

describe("busy times for the slot engine", () => {
  it("counts confirmed calls and live holds of this store only", async () => {
    const start = at("2030-02-04T04:00:00Z");
    const now = new Date("2030-02-01T00:00:00Z");
    const live = await hold(start, 30, now);
    const expired = await hold(at("2030-02-04T06:00:00Z"), 30, new Date("2030-01-01T00:00:00Z"));
    expect([live.result, expired.result]).toEqual(["held", "held"]);
    await hold(at("2030-02-04T05:00:00Z"), 30, now, other._id);

    const busy = await busyTimesForStore(store._id, at("2030-02-04T00:00:00Z"), at("2030-02-05T00:00:00Z"), now);
    expect(busy.map((time) => time.start.toISOString())).toEqual(["2030-02-04T04:00:00.000Z"]);

    await releaseBookingForOrder(live.order._id);
    expect(await busyTimesForStore(store._id, at("2030-02-04T00:00:00Z"), at("2030-02-05T00:00:00Z"), now)).toEqual([]);
  });
});

describe("confirming through the payment path", () => {
  const paid = async (orderId: string, eventId = `evt_${randomUUID()}`) => {
    const body = JSON.stringify({ id: eventId, type: "payment.succeeded", orderId });
    return handleWebhookRequest("mock", body, signMockBody(body));
  };

  it("confirms the booking once the order is paid, and a replay changes nothing", async () => {
    const { order, result } = await hold(at("2030-03-04T04:00:00Z"));
    expect(result).toBe("held");
    const eventId = `evt_${randomUUID()}`;
    expect((await paid(order._id, eventId)).status).toBe(200);
    const booking = await bookingOf(order._id);
    expect(booking).toMatchObject({ status: "confirmed", holdExpiresAt: null });
    expect((await paid(order._id, eventId)).body).toBe("duplicate");
    expect(await confirmBookingForOrder(order._id)).toBe("confirmed");
    expect((await bookingOf(order._id))?.confirmedAt?.getTime()).toBe(booking?.confirmedAt?.getTime());
  });

  it("gives the time back when the checkout fails", async () => {
    const start = at("2030-03-05T04:00:00Z");
    const { order } = await hold(start);
    await markOrderFailed(order._id);
    expect((await bookingOf(order._id))?.status).toBe("released");
    expect((await hold(start)).result).toBe("held");
  });

  it("marks a late payment 'conflict' when its time was taken meanwhile, and keeps the order paid", async () => {
    const start = at("2030-03-06T04:00:00Z");
    const late = await hold(start, 30, new Date("2030-01-01T00:00:00Z"));
    const winner = await hold(start, 30, new Date("2030-01-01T02:00:00Z")); // takes over the expired hold
    expect(winner.result).toBe("held");
    expect((await paid(winner.order._id)).status).toBe(200);
    expect((await paid(late.order._id)).status).toBe(200);
    expect((await bookingOf(winner.order._id))?.status).toBe("confirmed");
    expect((await bookingOf(late.order._id))?.status).toBe("conflict");
    const { orders } = await collections();
    expect((await orders.findOne({ _id: late.order._id }))?.status).toBe("paid");
  });

  it("does nothing for an order without a booking (a digital product)", async () => {
    const order = await seedOrder(call, { status: "pending", paidAt: null });
    expect(await confirmBookingForOrder(order._id)).toBeNull();
  });
});
