import "server-only";

import { formatCallTime } from "@/lib/coaching/ics";
import { collections, type EmailOutboxDoc } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { sendEmail } from "@/lib/email/send";
import { renderCallReminder } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import { inngest, inngestEnabled } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";

// Coaching call reminders (D-085): 24 hours and 1 hour before a confirmed call. When a booking is
// confirmed, one Inngest event starts a function that sleeps until each reminder time and then
// sends it. Each send checks again that the call is still confirmed, paid and at the same time, and
// one outbox row per order and reminder means a retry never emails twice.

export const CALL_CONFIRMED_EVENT = "coaching/call.confirmed";

export const REMINDERS = [
  { kind: "call-reminder-24h", minutesBefore: 24 * 60, lead: "in 24 hours" },
  { kind: "call-reminder-1h", minutesBefore: 60, lead: "in 1 hour" },
] as const satisfies readonly { kind: EmailOutboxDoc["kind"]; minutesBefore: number; lead: string }[];

export type ReminderKind = (typeof REMINDERS)[number]["kind"];

/** A "sending" row older than this is treated as cut off, as for the order email. */
const STUCK_SENDING_MS = 10 * 60 * 1000;

/**
 * The reminders still worth sending for a call starting at `start`, with when to send each. A
 * reminder whose time has already passed is skipped (a call booked 3 hours ahead gets only the
 * 1-hour reminder). Pure, for the Inngest function and its tests.
 */
export function reminderPlan(start: Date, now: Date): { kind: ReminderKind; sendAt: Date }[] {
  return REMINDERS.map((reminder) => ({ kind: reminder.kind, sendAt: new Date(start.getTime() - reminder.minutesBefore * 60_000) })).filter((item) => item.sendAt.getTime() > now.getTime());
}

/**
 * Starts the reminders of a confirmed call. Safe to call again: the event id is per order, so
 * Inngest runs the function once. Never throws (it runs inside the paid-order path).
 */
export async function scheduleCallReminders(orderId: string): Promise<void> {
  if (!inngestEnabled()) {
    logger.debug("coaching.reminders_not_configured", { orderId });
    return;
  }
  try {
    await inngest.send({ id: `call-confirmed-${orderId}`, name: CALL_CONFIRMED_EVENT, data: { orderId } });
  } catch (error) {
    logger.error("coaching.reminders_schedule_failed", { name: error instanceof Error ? error.name : undefined });
  }
}

/** The start time of a confirmed, paid call, as an ISO string, or null. */
export async function confirmedCallStart(orderId: string): Promise<string | null> {
  const { orders, bookings } = await collections();
  const [order, booking] = await Promise.all([orders.findOne({ _id: orderId, status: "paid" }, { projection: { booking: 1 } }), bookings.findOne({ orderId, status: "confirmed" }, { projection: { start: 1 } })]);
  if (!order?.booking || !booking) return null;
  return booking.start.toISOString();
}

/**
 * Sends one reminder, if the call is still confirmed, paid, in the future and at `expectedStart`
 * (a call moved or cancelled later gets no stale reminder).
 */
export async function sendCallReminder(orderId: string, kind: ReminderKind, expectedStart: string, now: Date = new Date()): Promise<"sent" | "skipped" | "failed"> {
  const reminder = REMINDERS.find((item) => item.kind === kind);
  if (!reminder) return "skipped";
  const { orders, bookings, products, stores, emailOutbox } = await collections();

  const [order, booking] = await Promise.all([orders.findOne({ _id: orderId, status: "paid" }), bookings.findOne({ orderId, status: "confirmed" }, { projection: { start: 1, end: 1 } })]);
  if (!order?.booking || !booking) return "skipped";
  if (booking.start.toISOString() !== expectedStart || booking.start.getTime() <= now.getTime()) return "skipped";

  const key = `${orderId}:${kind}`;
  try {
    await emailOutbox.insertOne({ _id: key, orderId, kind, status: "sending", attempts: 1, createdAt: now, sentAt: null });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const retry = await emailOutbox.updateOne(
      { _id: key, $or: [{ status: "failed" }, { status: "sending", createdAt: { $lt: new Date(now.getTime() - STUCK_SENDING_MS) } }] },
      { $set: { status: "sending", createdAt: now }, $inc: { attempts: 1 } },
    );
    if (retry.matchedCount === 0) return "skipped";
  }

  try {
    const [product, store] = await Promise.all([
      products.findOne({ _id: order.productId, storeId: order.storeId }, { projection: { "coaching.meetingUrl": 1, "coaching.timeZone": 1 } }),
      stores.findOne({ _id: order.storeId }, { projection: { name: 1 } }),
    ]);
    const email = renderCallReminder({
      storeName: store?.name ?? "Pickstall store",
      customerName: order.buyerName,
      productTitle: order.item.title,
      lead: reminder.lead,
      when: formatCallTime(booking.start, booking.end, order.booking.buyerTimeZone ?? product?.coaching?.timeZone ?? null),
      meetingUrl: product?.coaching?.meetingUrl ?? null,
      libraryUrl: new URL(`/library/${orderId}`, publicEnv.NEXT_PUBLIC_APP_URL).href,
    });
    await sendEmail({ to: order.buyerEmail, ...email });
    await emailOutbox.updateOne({ _id: key }, { $set: { status: "sent", sentAt: new Date() } });
    return "sent";
  } catch (error) {
    await emailOutbox.updateOne({ _id: key }, { $set: { status: "failed" } }).catch(() => undefined);
    logger.error("coaching.reminder_failed", { kind, name: error instanceof Error ? error.name : undefined });
    return "failed";
  }
}

/**
 * The Inngest function: for each reminder still ahead, sleep until its time, then send it. A failed
 * send throws so Inngest retries that step (the outbox keeps it from sending twice).
 */
export const callRemindersFunction = inngest.createFunction(
  { id: "coaching-call-reminders", triggers: [{ event: CALL_CONFIRMED_EVENT }] },
  async ({ event, step }) => {
    const orderId = typeof event.data?.orderId === "string" ? event.data.orderId : null;
    if (!orderId) return { skipped: "no order" };
    const start = await step.run("load-call", () => confirmedCallStart(orderId));
    if (!start) return { skipped: "not confirmed" };

    // Inside a step, so "now" is fixed once: Inngest replays the function body for every step.
    const plan = await step.run("plan", () => reminderPlan(new Date(start), new Date()).map((item) => ({ kind: item.kind, sendAt: item.sendAt.toISOString() })));
    for (const item of plan) {
      await step.sleepUntil(`wait-${item.kind}`, new Date(item.sendAt));
      await step.run(`send-${item.kind}`, async () => {
        const result = await sendCallReminder(orderId, item.kind, start);
        if (result === "failed") throw new Error("The reminder email could not be sent.");
        return result;
      });
    }
    return { reminders: plan.length };
  },
);
