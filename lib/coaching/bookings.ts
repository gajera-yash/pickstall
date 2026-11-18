import "server-only";

import { randomUUID } from "node:crypto";

import type { Filter } from "mongodb";

import type { BusyTime } from "@/lib/coaching/slots";
import { collections, type BookingDoc } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { logger } from "@/lib/logger";

// Coaching bookings (D-083). A booking holds its time while the buyer pays and is confirmed only
// from the one place an order becomes paid (lib/payments/process.ts), never from a success page.
// Two rules keep a store from double-booking:
//   1. a unique index on `activeSlot` (store + start): two calls can never start at the same moment;
//   2. after a hold is written, any overlapping active booking of the store (another length) that
//      came first wins, and the later one lets go. Both sides use the same order, so one survives.

/** A hold lasts a little longer than a Stripe checkout session (60 minutes), so a payment can always land on it. */
export const HOLD_MINUTES = 65;

/** The longest call (COACHING_DURATIONS) plus room: how far back a booking may start and still overlap. */
const LONGEST_CALL_MS = 3 * 60 * 60_000;

export const slotKey = (storeId: string, start: Date) => `${storeId}|${start.toISOString()}`;

/** Bookings that take their time now: confirmed ones, and holds that have not run out. */
function activeAt(now: Date): Filter<BookingDoc> {
  return { $or: [{ status: "confirmed" }, { status: "held", holdExpiresAt: { $gt: now } }] };
}

/** The store's taken times overlapping [from, to), for the slot engine. Scoped to one store. */
export async function busyTimesForStore(storeId: string, from: Date, to: Date, now: Date = new Date()): Promise<BusyTime[]> {
  const { bookings } = await collections();
  const rows = await bookings
    .find({ storeId, start: { $lt: to, $gte: new Date(from.getTime() - LONGEST_CALL_MS) }, end: { $gt: from }, ...activeAt(now) }, { projection: { start: 1, end: 1 } })
    .toArray();
  return rows.map((row) => ({ start: row.start, end: row.end }));
}

/** True when an overlapping active booking of the store (not `self`) was created before `self` (ties: lower id). */
async function hasEarlierRival(self: Pick<BookingDoc, "_id" | "storeId" | "start" | "end" | "createdAt">, now: Date): Promise<boolean> {
  const { bookings } = await collections();
  const rivals = await bookings
    .find({ storeId: self.storeId, _id: { $ne: self._id }, start: { $lt: self.end }, end: { $gt: self.start }, ...activeAt(now) }, { projection: { _id: 1, createdAt: 1 } })
    .toArray();
  return rivals.some((rival) => rival.createdAt < self.createdAt || (rival.createdAt.getTime() === self.createdAt.getTime() && rival._id < self._id));
}

/** True when an overlapping call of the store (not `self`) was confirmed before `confirmedAt` (ties: lower id). */
async function hasEarlierConfirmed(self: Pick<BookingDoc, "_id" | "storeId" | "start" | "end">, confirmedAt: Date): Promise<boolean> {
  const { bookings } = await collections();
  const rivals = await bookings
    .find({ storeId: self.storeId, _id: { $ne: self._id }, status: "confirmed", start: { $lt: self.end }, end: { $gt: self.start } }, { projection: { _id: 1, confirmedAt: 1 } })
    .toArray();
  return rivals.some((rival) => {
    const at = rival.confirmedAt?.getTime() ?? 0;
    return at < confirmedAt.getTime() || (at === confirmedAt.getTime() && rival._id < self._id);
  });
}

export type HoldInput = { storeId: string; productId: string; orderId: string; start: Date; end: Date; buyerTimeZone: string | null };

/**
 * Holds a time for a pending coaching order. Returns "taken" when another booking has it (the
 * caller then fails the order and asks the buyer to pick again). An expired hold that still owns
 * the time is let go first.
 */
export async function holdSlot(input: HoldInput, now: Date = new Date()): Promise<"held" | "taken"> {
  const { bookings } = await collections();
  const activeSlot = slotKey(input.storeId, input.start);
  const doc: BookingDoc = {
    _id: randomUUID(),
    ...input,
    status: "held",
    activeSlot,
    holdExpiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000),
    createdAt: now,
    updatedAt: now,
  };

  let inserted = false;
  for (let attempt = 0; attempt < 2 && !inserted; attempt++) {
    try {
      await bookings.insertOne(doc);
      inserted = true;
    } catch (error) {
      if (!isDuplicateKeyError(error, "activeSlot")) throw error;
      const freed = await bookings.updateOne(
        { activeSlot, status: "held", holdExpiresAt: { $lte: now } },
        { $set: { status: "released", activeSlot: null, holdExpiresAt: null, updatedAt: now } },
      );
      if (freed.modifiedCount !== 1) return "taken";
    }
  }
  if (!inserted) return "taken";

  if (await hasEarlierRival(doc, now)) {
    await bookings.updateOne({ _id: doc._id, status: "held" }, { $set: { status: "released", activeSlot: null, holdExpiresAt: null, updatedAt: new Date() } });
    return "taken";
  }
  return "held";
}

/** Lets go of a pending order's hold (payment failed, expired, or the checkout could not start). */
export async function releaseBookingForOrder(orderId: string, now: Date = new Date()): Promise<void> {
  const { bookings } = await collections();
  await bookings.updateOne({ orderId, status: "held" }, { $set: { status: "released", activeSlot: null, holdExpiresAt: null, updatedAt: now } });
}

/**
 * Confirms the booking of an order that just became paid. Idempotent: a replay changes nothing.
 * Called only from the paid-order path. If the time was lost meanwhile (the hold ran out and
 * someone else confirmed it), the booking becomes "conflict" and the order stays paid.
 */
export async function confirmBookingForOrder(orderId: string, now: Date = new Date()): Promise<BookingDoc["status"] | null> {
  const { bookings } = await collections();
  const booking = await bookings.findOne({ orderId });
  if (!booking) return null;
  if (booking.status === "confirmed" || booking.status === "conflict") return booking.status;

  const activeSlot = slotKey(booking.storeId, booking.start);
  try {
    // Keeps (or takes back) its own start time; the unique index refuses it if another booking has it.
    const result = await bookings.updateOne(
      { _id: booking._id, status: { $in: ["held", "released"] } },
      { $set: { status: "confirmed", activeSlot, holdExpiresAt: null, confirmedAt: now, updatedAt: now } },
    );
    if (result.matchedCount !== 1) return (await bookings.findOne({ _id: booking._id }, { projection: { status: 1 } }))?.status ?? null;
  } catch (error) {
    if (!isDuplicateKeyError(error, "activeSlot")) throw error;
    await markConflict(booking._id, now);
    return "conflict";
  }

  // With overlapping calls of different lengths, the first one confirmed keeps its time.
  if (await hasEarlierConfirmed(booking, now)) {
    await markConflict(booking._id, now);
    return "conflict";
  }
  return "confirmed";
}

async function markConflict(bookingId: string, now: Date): Promise<void> {
  const { bookings } = await collections();
  await bookings.updateOne({ _id: bookingId }, { $set: { status: "conflict", activeSlot: null, holdExpiresAt: null, updatedAt: now } });
  logger.error("coaching.booking_conflict", { bookingId });
}
