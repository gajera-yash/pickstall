import "server-only";

import { collections } from "@/lib/db/collections";

export type OrderEmailStatus = { status: "sent" | "failed" | "sending"; sentAt: Date | null; attempts: number } | null;

/** Delivery status of an order's access email, or null when none was tried. The caller checks the order is the creator's. */
export async function orderEmailStatus(orderId: string): Promise<OrderEmailStatus> {
  const { emailOutbox } = await collections();
  const doc = await emailOutbox.findOne({ _id: `${orderId}:order-confirmation` }, { projection: { status: 1, sentAt: 1, attempts: 1 } });
  return doc ? { status: doc.status, sentAt: doc.sentAt, attempts: doc.attempts } : null;
}
