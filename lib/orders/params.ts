import { z } from "zod";

export const ORDER_STATUSES = ["paid", "pending", "refunded", "failed"] as const;
export type OrderStatusFilter = (typeof ORDER_STATUSES)[number];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

type Raw = Record<string, string | string[] | undefined>;

const idSchema = z.uuid();
const qSchema = z.string().trim().min(1).max(80);

export type OrderParams = { status?: OrderStatusFilter; q?: string; product?: string; before?: Date; order?: string };

/**
 * Reads the Orders page query string defensively: unknown statuses, odd dates, ids that are not
 * uuids and overlong text are dropped instead of reaching the database. `order` opens the details
 * drawer; it is only ever looked up inside the signed-in creator's store.
 */
export function parseOrderParams(raw: Raw): OrderParams {
  const status = z.enum(ORDER_STATUSES).safeParse(first(raw.status));
  const q = qSchema.safeParse(first(raw.q));
  const product = idSchema.safeParse(first(raw.product));
  const before = z.iso.datetime().safeParse(first(raw.before));
  const order = idSchema.safeParse(first(raw.order));
  return {
    ...(status.success ? { status: status.data } : {}),
    ...(q.success ? { q: q.data } : {}),
    ...(product.success ? { product: product.data } : {}),
    ...(before.success ? { before: new Date(before.data) } : {}),
    ...(order.success ? { order: order.data } : {}),
  };
}

/** Where the customer list continues: the last row's latest order time and order id (never an email). */
export type CustomerCursor = { at: Date; id: string };

export type CustomerParams = { q?: string; product?: string; after?: CustomerCursor; customer?: string };

export function encodeCustomerCursor(cursor: CustomerCursor): string {
  return `${cursor.at.toISOString()}~${cursor.id}`;
}

/**
 * Reads the Customers page query string. A customer is opened by one of their order ids
 * (`customer`), so no email ever goes into a URL.
 */
export function parseCustomerParams(raw: Raw): CustomerParams {
  const q = qSchema.safeParse(first(raw.q));
  const product = idSchema.safeParse(first(raw.product));
  const customer = idSchema.safeParse(first(raw.customer));
  const [at, id] = (first(raw.after) ?? "").split("~");
  const afterAt = z.iso.datetime().safeParse(at);
  const afterId = idSchema.safeParse(id);
  return {
    ...(q.success ? { q: q.data } : {}),
    ...(product.success ? { product: product.data } : {}),
    ...(afterAt.success && afterId.success ? { after: { at: new Date(afterAt.data), id: afterId.data } } : {}),
    ...(customer.success ? { customer: customer.data } : {}),
  };
}

/** A dashboard link with only the given, non-empty query values. */
export function withQuery(path: string, values: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
