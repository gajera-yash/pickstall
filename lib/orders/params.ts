import { z } from "zod";

export const ORDER_STATUSES = ["paid", "pending", "refunded", "failed"] as const;
export type OrderStatusFilter = (typeof ORDER_STATUSES)[number];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export type OrderParams = { status?: OrderStatusFilter; q?: string; before?: Date };

/**
 * Reads the Orders page query string defensively: unknown statuses, odd dates and overlong text
 * are dropped instead of reaching the database.
 */
export function parseOrderParams(raw: Record<string, string | string[] | undefined>): OrderParams {
  const status = z.enum(ORDER_STATUSES).safeParse(first(raw.status));
  const q = z.string().trim().min(1).max(80).safeParse(first(raw.q));
  const before = z.iso.datetime().safeParse(first(raw.before));
  return {
    ...(status.success ? { status: status.data } : {}),
    ...(q.success ? { q: q.data } : {}),
    ...(before.success ? { before: new Date(before.data) } : {}),
  };
}
