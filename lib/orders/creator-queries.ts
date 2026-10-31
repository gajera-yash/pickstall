import "server-only";

import type { Filter } from "mongodb";

import { collections, type OrderAnswerDoc, type OrderDoc } from "@/lib/db/collections";
import { escapeRegex } from "@/lib/orders/csv";
import type { OrderStatusFilter } from "@/lib/orders/params";
import { buildSeries, type DayRow, type Series } from "@/lib/orders/series";

// Orders, customers and income for the signed-in creator. MongoDB has no row-level security, so
// every query here starts from `storeId`: callers pass the store id of `requireCreator()`, never an
// id from the request. Customers are derived from paid orders, so they can never drift from them.

export const PAGE_SIZE = 20;

export type OrderRow = {
  id: string;
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

export type OrderPage = { orders: OrderRow[]; nextBefore: string | null };

/** One page of this store's orders, newest first. `before` is the createdAt of the last row seen. */
export async function listOrders(storeId: string, options: { status?: OrderStatusFilter; q?: string; before?: Date; limit?: number } = {}): Promise<OrderPage> {
  const { orders } = await collections();
  const limit = options.limit ?? PAGE_SIZE;
  const filter: Filter<OrderDoc> = {
    storeId,
    ...(options.status ? { status: options.status } : {}),
    ...(options.before ? { createdAt: { $lt: options.before } } : {}),
    ...searchFilter(options.q),
  };
  const docs = await orders.find(filter).sort({ createdAt: -1 }).limit(limit + 1).toArray();
  const page = docs.slice(0, limit);
  return { orders: page.map(toRow), nextBefore: docs.length > limit ? (page.at(-1)?.createdAt.toISOString() ?? null) : null };
}

export async function countOrdersByStatus(storeId: string): Promise<Record<OrderStatusFilter, number>> {
  const { orders } = await collections();
  const rows = await orders.aggregate<{ _id: OrderStatusFilter; count: number }>([{ $match: { storeId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]).toArray();
  const counts: Record<OrderStatusFilter, number> = { paid: 0, pending: 0, refunded: 0, failed: 0 };
  for (const row of rows) counts[row._id] = row.count;
  return counts;
}

export type CustomerRow = {
  email: string;
  name: string;
  phone: string | null;
  orderCount: number;
  totalCents: number;
  lastOrderAt: Date;
  orders: { id: string; title: string; totalCents: number; paidAt: Date | null; answers: OrderAnswerDoc[] }[];
};

type CustomerAgg = { _id: string; name: string; phone: string | null; orderCount: number; totalCents: number; lastOrderAt: Date };

/** The store's customers (people with at least one paid order) with their totals and orders. */
export async function listCustomers(storeId: string, options: { q?: string; limit?: number } = {}): Promise<CustomerRow[]> {
  const { orders } = await collections();
  const limit = options.limit ?? 50;
  const groups = await orders
    .aggregate<CustomerAgg>([
      { $match: { storeId, status: "paid", ...searchFilter(options.q) } },
      { $sort: { paidAt: -1 } },
      {
        $group: {
          _id: "$buyerEmail",
          name: { $first: "$buyerName" },
          phone: { $first: "$buyerPhone" },
          orderCount: { $sum: 1 },
          totalCents: { $sum: "$totalCents" },
          lastOrderAt: { $first: "$paidAt" },
        },
      },
      { $sort: { lastOrderAt: -1 } },
      { $limit: limit },
    ])
    .toArray();
  if (groups.length === 0) return [];

  const emails = groups.map((group) => group._id);
  const docs = await orders.find({ storeId, status: "paid", buyerEmail: { $in: emails } }).sort({ paidAt: -1 }).toArray();
  return groups.map((group) => ({
    email: group._id,
    name: group.name,
    phone: group.phone,
    orderCount: group.orderCount,
    totalCents: group.totalCents,
    lastOrderAt: group.lastOrderAt,
    orders: docs
      .filter((doc) => doc.buyerEmail === group._id)
      .map((doc) => ({ id: doc._id, title: doc.item.title, totalCents: doc.totalCents, paidAt: doc.paidAt, answers: doc.answers })),
  }));
}

/** Every paid order of the store with buyer details and answers, for the CSV export. */
export async function listPaidOrdersForExport(storeId: string, limit = 5000): Promise<OrderRow[]> {
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
