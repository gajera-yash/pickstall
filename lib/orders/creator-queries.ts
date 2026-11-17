import "server-only";

import type { Filter } from "mongodb";

import { collections, type OrderAnswerDoc, type OrderDoc } from "@/lib/db/collections";
import { orderEmailStatus, type OrderEmailStatus } from "@/lib/orders/email-status";
import { escapeRegex } from "@/lib/orders/csv";
import type { CustomerCursor, OrderStatusFilter } from "@/lib/orders/params";
import { buildSeries, type DayRow, type Series } from "@/lib/orders/series";

// Orders, customers and income for the signed-in creator. MongoDB has no row-level security, so
// every query here starts from `storeId`: callers pass the store id of `requireCreator()`, never an
// id from the request. Customers are derived from paid orders, so they can never drift from them.

export const PAGE_SIZE = 20;
export const CUSTOMER_PAGE_SIZE = 25;
const EXPORT_MAX_ROWS = 5000;

export type OrderRow = {
  id: string;
  productId: string;
  title: string;
  buyerName: string;
  buyerEmail: string;
  totalCents: number;
  currency: string;
  status: OrderDoc["status"];
  provider: OrderDoc["provider"];
  answers: OrderAnswerDoc[];
  createdAt: Date;
};

function toRow(doc: OrderDoc): OrderRow {
  return {
    id: doc._id,
    productId: doc.productId,
    title: doc.item.title,
    buyerName: doc.buyerName,
    buyerEmail: doc.buyerEmail,
    totalCents: doc.totalCents,
    currency: doc.currency,
    status: doc.status,
    provider: doc.provider,
    answers: doc.answers,
    createdAt: doc.createdAt,
  };
}

/** A prefix-or-substring text search over name and email, with the user's text escaped. */
function searchFilter(q: string | undefined): Filter<OrderDoc> {
  const text = q?.trim().slice(0, 80);
  if (!text) return {};
  const pattern = new RegExp(escapeRegex(text), "i");
  return { $or: [{ buyerEmail: pattern }, { buyerName: pattern }] };
}

export type OrderFilters = { status?: OrderStatusFilter; q?: string; product?: string };

function orderFilter(storeId: string, filters: OrderFilters): Filter<OrderDoc> {
  return {
    storeId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.product ? { productId: filters.product } : {}),
    ...searchFilter(filters.q),
  };
}

export type OrderPage = { orders: OrderRow[]; nextBefore: string | null };

/** One page of this store's orders, newest first. `before` is the createdAt of the last row seen. */
export async function listOrders(storeId: string, options: OrderFilters & { before?: Date; limit?: number } = {}): Promise<OrderPage> {
  const { orders } = await collections();
  const limit = options.limit ?? PAGE_SIZE;
  const filter: Filter<OrderDoc> = { ...orderFilter(storeId, options), ...(options.before ? { createdAt: { $lt: options.before } } : {}) };
  const docs = await orders.find(filter).sort({ createdAt: -1 }).limit(limit + 1).toArray();
  const page = docs.slice(0, limit);
  return { orders: page.map(toRow), nextBefore: docs.length > limit ? (page.at(-1)?.createdAt.toISOString() ?? null) : null };
}

/** The store's orders matching the Orders page filters, newest first, for the orders CSV. */
export async function listOrdersForExport(storeId: string, filters: OrderFilters = {}): Promise<OrderRow[]> {
  const { orders } = await collections();
  const docs = await orders.find(orderFilter(storeId, filters)).sort({ createdAt: -1 }).limit(EXPORT_MAX_ROWS).toArray();
  return docs.map(toRow);
}

export type OrderDetail = OrderRow & {
  buyerPhone: string | null;
  subtotalCents: number;
  discountCents: number;
  paidAt: Date | null;
  accessCount: number;
  /** The product's current download limit, or null for unlimited or a deleted product. */
  downloadLimit: number | null;
  /** Refunds (D-053): a refund can be asked for a paid order taken by a provider (not a free one). */
  refundable: boolean;
  refundRequestedAt: Date | null;
  refundedAt: Date | null;
  amountRefundedCents: number;
  /** Delivery of the buyer's access email (null when none was tried yet). */
  accessEmail: OrderEmailStatus;
};

/** One order of this store for the details drawer, or null when it is not this store's. */
export async function findOrderDetail(storeId: string, orderId: string): Promise<OrderDetail | null> {
  const { orders, products } = await collections();
  const doc = await orders.findOne({ _id: orderId, storeId });
  if (!doc) return null;
  const product = await products.findOne({ _id: doc.productId, storeId }, { projection: { downloadLimit: 1 } });
  return {
    ...toRow(doc),
    buyerPhone: doc.buyerPhone,
    subtotalCents: doc.subtotalCents,
    discountCents: doc.discountCents,
    paidAt: doc.paidAt,
    accessCount: doc.accessCount ?? 0,
    downloadLimit: product?.downloadLimit ?? null,
    refundable: doc.status === "paid" && doc.provider !== "free" && Boolean(doc.providerPaymentId),
    refundRequestedAt: doc.refundRequestedAt ?? null,
    refundedAt: doc.refundedAt ?? null,
    amountRefundedCents: doc.amountRefundedCents ?? 0,
    // Read only after the order was found with this store's id, so it is never another store's.
    accessEmail: await orderEmailStatus(doc._id),
  };
}

/** A paid order of THIS store that a provider took, for the refund action. Null when it is not refundable. */
export async function findRefundableOrder(
  storeId: string,
  orderId: string,
): Promise<{ id: string; provider: "stripe" | "mock"; providerPaymentId: string; totalCents: number } | null> {
  const { orders } = await collections();
  const doc = await orders.findOne(
    { _id: orderId, storeId, status: "paid", provider: { $in: ["stripe", "mock"] }, providerPaymentId: { $type: "string" } },
    { projection: { provider: 1, providerPaymentId: 1, totalCents: 1 } },
  );
  if (!doc || (doc.provider !== "stripe" && doc.provider !== "mock") || !doc.providerPaymentId) return null;
  return { id: doc._id, provider: doc.provider, providerPaymentId: doc.providerPaymentId, totalCents: doc.totalCents };
}

/** Notes that the creator asked for a refund. The order stays paid until the provider's refund event arrives. */
export async function markRefundRequested(storeId: string, orderId: string): Promise<void> {
  const { orders } = await collections();
  await orders.updateOne({ _id: orderId, storeId }, { $set: { refundRequestedAt: new Date() } });
}

export async function countOrdersByStatus(storeId: string): Promise<Record<OrderStatusFilter, number>> {
  const { orders } = await collections();
  const rows = await orders.aggregate<{ _id: OrderStatusFilter; count: number }>([{ $match: { storeId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]).toArray();
  const counts: Record<OrderStatusFilter, number> = { paid: 0, pending: 0, refunded: 0, failed: 0 };
  for (const row of rows) counts[row._id] = row.count;
  return counts;
}

export type CustomerRow = {
  /** The id of their latest paid order: opens the drawer and pages the list, so no email goes into a URL. */
  key: string;
  email: string;
  name: string;
  phone: string | null;
  orderCount: number;
  totalCents: number;
  lastOrderAt: Date;
  /** Distinct products bought, newest first. */
  products: string[];
  answersCount: number;
};

type CustomerAgg = {
  _id: string;
  name: string;
  phone: string | null;
  orderCount: number;
  totalCents: number;
  lastOrderAt: Date;
  lastOrderId: string;
  products: string[];
  productIds: string[];
  answersCount: number;
};

export type CustomerPage = { customers: CustomerRow[]; next: CustomerCursor | null };

/**
 * The store's customers (people with at least one paid order) with their totals, newest buyer
 * first. `product` keeps only people who bought that product (their totals stay complete);
 * `after` continues from the last row of the previous page.
 */
export async function listCustomers(storeId: string, options: { q?: string; product?: string; after?: CustomerCursor; limit?: number } = {}): Promise<CustomerPage> {
  const { orders } = await collections();
  const limit = options.limit ?? CUSTOMER_PAGE_SIZE;
  const after = options.after;
  const groups = await orders
    .aggregate<CustomerAgg>([
      { $match: { storeId, status: "paid", ...searchFilter(options.q) } },
      { $sort: { paidAt: -1, _id: -1 } },
      {
        $group: {
          _id: "$buyerEmail",
          name: { $first: "$buyerName" },
          phone: { $first: "$buyerPhone" },
          orderCount: { $sum: 1 },
          totalCents: { $sum: "$totalCents" },
          lastOrderAt: { $first: "$paidAt" },
          lastOrderId: { $first: "$_id" },
          products: { $addToSet: "$item.title" },
          productIds: { $addToSet: "$productId" },
          answersCount: { $sum: { $size: { $ifNull: ["$answers", []] } } },
        },
      },
      ...(options.product ? [{ $match: { productIds: options.product } }] : []),
      ...(after ? [{ $match: { $or: [{ lastOrderAt: { $lt: after.at } }, { lastOrderAt: after.at, lastOrderId: { $lt: after.id } }] } }] : []),
      { $sort: { lastOrderAt: -1, lastOrderId: -1 } },
      { $limit: limit + 1 },
    ])
    .toArray();

  const page = groups.slice(0, limit);
  const last = page.at(-1);
  return {
    customers: page.map((group) => ({
      key: group.lastOrderId,
      email: group._id,
      name: group.name,
      phone: group.phone,
      orderCount: group.orderCount,
      totalCents: group.totalCents,
      lastOrderAt: group.lastOrderAt,
      products: group.products,
      answersCount: group.answersCount,
    })),
    next: groups.length > limit && last ? { at: last.lastOrderAt, id: last.lastOrderId } : null,
  };
}

export type CustomerDetail = {
  key: string;
  email: string;
  name: string;
  phone: string | null;
  orderCount: number;
  totalCents: number;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  orders: { id: string; title: string; totalCents: number; currency: string; paidAt: Date | null; provider: OrderDoc["provider"]; answers: OrderAnswerDoc[] }[];
};

/**
 * A customer of this store for the details drawer, found through one of their orders (`orderId`).
 * Only this store's orders are read, and only paid ones count; null when there are none.
 */
export async function findCustomerDetail(storeId: string, orderId: string): Promise<CustomerDetail | null> {
  const { orders } = await collections();
  const order = await orders.findOne({ _id: orderId, storeId }, { projection: { buyerEmail: 1 } });
  if (!order) return null;
  const docs = await orders.find({ storeId, buyerEmail: order.buyerEmail, status: "paid" }).sort({ paidAt: -1 }).limit(100).toArray();
  const latest = docs[0];
  if (!latest) return null;
  return {
    key: latest._id,
    email: latest.buyerEmail,
    name: latest.buyerName,
    phone: docs.find((doc) => doc.buyerPhone)?.buyerPhone ?? null,
    orderCount: docs.length,
    totalCents: docs.reduce((sum, doc) => sum + doc.totalCents, 0),
    firstOrderAt: docs.at(-1)?.paidAt ?? null,
    lastOrderAt: latest.paidAt,
    orders: docs.map((doc) => ({ id: doc._id, title: doc.item.title, totalCents: doc.totalCents, currency: doc.currency, paidAt: doc.paidAt, provider: doc.provider, answers: doc.answers })),
  };
}

/** Every paid order of the store with buyer details and answers, for the customers CSV. */
export async function listPaidOrdersForExport(storeId: string, limit = EXPORT_MAX_ROWS): Promise<OrderRow[]> {
  const { orders } = await collections();
  const docs = await orders.find({ storeId, status: "paid" }).sort({ paidAt: -1 }).limit(limit).toArray();
  return docs.map((doc) => ({ ...toRow(doc), createdAt: doc.paidAt ?? doc.createdAt }));
}

export type IncomeStats = {
  series: Series;
  customersInRange: number;
  topProducts: { productId: string; title: string; orders: number; revenueCents: number }[];
  refundedCents: number;
  totalPaidOrders: number;
};

/** Paid sales of the last `days` UTC days in the store's currency, per day, plus top products. */
export async function incomeStats(storeId: string, currency: string, days: number, now = new Date()): Promise<IncomeStats> {
  const { orders } = await collections();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
  const paidInRange = { storeId, status: "paid" as const, currency, paidAt: { $gte: since } };

  const [dayRows, customers, top, refunded, totalPaidOrders] = await Promise.all([
    orders
      .aggregate<{ _id: string; revenueCents: number; orders: number; buyers: string[] }>([
        { $match: paidInRange },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt", timezone: "UTC" } }, revenueCents: { $sum: "$totalCents" }, orders: { $sum: 1 }, buyers: { $addToSet: "$buyerEmail" } } },
      ])
      .toArray(),
    orders.distinct("buyerEmail", paidInRange),
    orders
      .aggregate<{ _id: string; title: string; orders: number; revenueCents: number }>([
        { $match: paidInRange },
        { $sort: { paidAt: -1 } },
        { $group: { _id: "$productId", title: { $first: "$item.title" }, orders: { $sum: 1 }, revenueCents: { $sum: "$totalCents" } } },
        { $sort: { revenueCents: -1 } },
        { $limit: 5 },
      ])
      .toArray(),
    orders.aggregate<{ total: number }>([{ $match: { storeId, status: "refunded", currency, createdAt: { $gte: since } } }, { $group: { _id: null, total: { $sum: "$totalCents" } } }]).toArray(),
    orders.countDocuments({ storeId, status: "paid" }),
  ]);

  const rows: DayRow[] = dayRows.map((row) => ({ day: row._id, revenueCents: row.revenueCents, orders: row.orders, customers: row.buyers.length }));
  return {
    series: buildSeries(rows, days, now),
    customersInRange: customers.length,
    topProducts: top.map((row) => ({ productId: row._id, title: row.title, orders: row.orders, revenueCents: row.revenueCents })),
    refundedCents: refunded[0]?.total ?? 0,
    totalPaidOrders,
  };
}
