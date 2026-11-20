import "server-only";

import { ObjectId } from "mongodb";

import { PLANNED_PRICE_CENTS, type PaidPlan } from "@/lib/config";
import { collections, type StoreDoc } from "@/lib/db/collections";
import { getDb } from "@/lib/db/mongo";
import { escapeRegex } from "@/lib/orders/csv";
import { storeAccess, type StoreAccess } from "@/lib/plans/access";

// Platform admin data (D-104), read-only. Only called from /admin pages after requireAdmin(); these
// functions read across all stores on purpose. Better Auth's `user` collection is only read.

const DAY_MS = 24 * 60 * 60 * 1000;
const NOT_BUMP = { bumpOf: { $in: [null] } };
const PAGE = 50;

/** Better Auth ids may be ObjectIds in MongoDB; stores keep them as strings. */
function userIdFilter(id: string) {
  return ObjectId.isValid(id) && id.length === 24 ? { _id: new ObjectId(id) } : { _id: id as unknown as ObjectId };
}

async function ownerEmails(ownerIds: string[]): Promise<Map<string, string>> {
  if (ownerIds.length === 0) return new Map();
  const db = await getDb();
  const ids = ownerIds.map((id) => userIdFilter(id)._id);
  const users = await db.collection("user").find({ _id: { $in: ids } }, { projection: { email: 1 } }).toArray();
  return new Map(users.map((user) => [String(user._id), typeof user.email === "string" ? user.email : ""]));
}

export type MoneyByCurrency = { currency: string; cents: number }[];

export type AdminOverview = {
  creators: number;
  signups7: number;
  signups30: number;
  liveStores: number;
  paid: Record<PaidPlan, number>;
  founding: number;
  trials: number;
  paused: number;
  trialsEndingSoon: number;
  mrrCents: number;
  orders30: number;
  sales30: MoneyByCurrency;
  salesAll: MoneyByCurrency;
  subscribers: number;
  broadcasts30: number;
};

function accessOf(store: Pick<StoreDoc, "planTier" | "trialEndsAt" | "foundingEndsAt" | "billing">, now: Date): StoreAccess {
  return storeAccess(store, now);
}

/** The platform's headline numbers. Sales are creators' sales (their money), by currency. */
export async function adminOverview(now: Date = new Date()): Promise<AdminOverview> {
  const { stores, orders, subscribers, broadcasts } = await collections();
  const since7 = new Date(now.getTime() - 7 * DAY_MS);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const all = await stores.find({ deletedAt: { $exists: false } }, { projection: { planTier: 1, trialEndsAt: 1, foundingEndsAt: 1, billing: 1, isPublished: 1, createdAt: 1 } }).toArray();

  const overview: AdminOverview = { creators: all.length, signups7: 0, signups30: 0, liveStores: 0, paid: { starter: 0, pro: 0 }, founding: 0, trials: 0, paused: 0, trialsEndingSoon: 0, mrrCents: 0, orders30: 0, sales30: [], salesAll: [], subscribers: 0, broadcasts30: 0 };
  for (const store of all) {
    if (store.createdAt >= since7) overview.signups7 += 1;
    if (store.createdAt >= since30) overview.signups30 += 1;
    if (store.isPublished) overview.liveStores += 1;
    const access = accessOf(store, now);
    if (access.plan && (access.state === "active" || access.state === "past_due")) {
      overview.paid[access.plan] += 1;
      overview.mrrCents += PLANNED_PRICE_CENTS[access.plan];
    } else if (access.state === "founding") overview.founding += 1;
    else if (access.state === "trial") {
      overview.trials += 1;
      if (access.daysLeft !== null && access.daysLeft <= 7) overview.trialsEndingSoon += 1;
    } else if (access.state === "paused") overview.paused += 1;
  }

  const salesBy = async (match: Record<string, unknown>): Promise<MoneyByCurrency> => {
    const rows = await orders.aggregate<{ _id: string; cents: number }>([{ $match: { status: "paid", ...NOT_BUMP, ...match } }, { $group: { _id: "$currency", cents: { $sum: "$totalCents" } } }, { $sort: { cents: -1 } }]).toArray();
    return rows.map((row) => ({ currency: row._id, cents: row.cents }));
  };
  [overview.sales30, overview.salesAll, overview.orders30, overview.subscribers, overview.broadcasts30] = await Promise.all([
    salesBy({ paidAt: { $gte: since30 } }),
    salesBy({}),
    orders.countDocuments({ status: "paid", ...NOT_BUMP, paidAt: { $gte: since30 } }),
    subscribers.countDocuments({ status: "subscribed" }),
    broadcasts.countDocuments({ createdAt: { $gte: since30 } }),
  ]);
  return overview;
}

export type AdminStoreRow = {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  isPublished: boolean;
  access: StoreAccess;
  stripeConnected: boolean;
  createdAt: Date;
};

/** Creators' stores, newest first, searchable by store name, username or owner email. */
export async function adminListStores(options: { q?: string; before?: Date } = {}, now: Date = new Date()): Promise<{ rows: AdminStoreRow[]; nextBefore: string | null }> {
  const { stores } = await collections();
  const q = options.q?.trim().slice(0, 100);
  let ownerFilter: string[] | null = null;
  if (q && q.includes("@")) {
    const db = await getDb();
    const users = await db.collection("user").find({ email: q.toLowerCase() }, { projection: { _id: 1 } }).limit(5).toArray();
    ownerFilter = users.map((user) => String(user._id));
  }
  const filter = {
    deletedAt: { $exists: false },
    ...(options.before ? { createdAt: { $lt: options.before } } : {}),
    ...(ownerFilter ? { ownerId: { $in: ownerFilter } } : q ? { $or: [{ name: { $regex: escapeRegex(q), $options: "i" } }, { slug: { $regex: escapeRegex(q.toLowerCase()) } }] } : {}),
  };
  const docs = await stores.find(filter, { projection: { name: 1, slug: 1, ownerId: 1, isPublished: 1, planTier: 1, trialEndsAt: 1, foundingEndsAt: 1, billing: 1, stripeChargesEnabled: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(PAGE + 1).toArray();
  const page = docs.slice(0, PAGE);
  const emails = await ownerEmails(page.map((doc) => doc.ownerId));
  return {
    rows: page.map((doc) => ({ id: doc._id, name: doc.name, slug: doc.slug, ownerEmail: emails.get(doc.ownerId) ?? "", isPublished: doc.isPublished, access: accessOf(doc, now), stripeConnected: doc.stripeChargesEnabled, createdAt: doc.createdAt })),
    nextBefore: docs.length > PAGE ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
  };
}

export type AdminStoreDetail = AdminStoreRow & {
  currency: string;
  trialEndsAt: Date | null;
  products: { id: string; title: string; type: string; status: string; priceCents: number }[];
  orders: { paid: number; sales: MoneyByCurrency; recent: { id: string; title: string; buyerEmail: string; totalCents: number; currency: string; status: string; createdAt: Date }[] };
  subscribers: { subscribed: number; unsubscribed: number; bounced: number; complained: number };
  broadcasts: number;
};

/** One store with its products, orders, list and broadcasts. */
export async function adminStoreDetail(storeId: string, now: Date = new Date()): Promise<AdminStoreDetail | null> {
  const { stores, products, orders, subscribers, broadcasts } = await collections();
  const doc = await stores.findOne({ _id: storeId });
  if (!doc) return null;
  const [emails, productDocs, paid, salesRows, recent, subRows, broadcastCount] = await Promise.all([
    ownerEmails([doc.ownerId]),
    products.find({ storeId, deletedAt: { $in: [null] } }, { projection: { title: 1, type: 1, status: 1, priceCents: 1 } }).sort({ createdAt: -1 }).limit(100).toArray(),
    orders.countDocuments({ storeId, status: "paid", ...NOT_BUMP }),
    orders.aggregate<{ _id: string; cents: number }>([{ $match: { storeId, status: "paid", ...NOT_BUMP } }, { $group: { _id: "$currency", cents: { $sum: "$totalCents" } } }]).toArray(),
    orders.find({ storeId, ...NOT_BUMP }, { projection: { item: 1, buyerEmail: 1, totalCents: 1, currency: 1, status: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(10).toArray(),
    subscribers.aggregate<{ _id: { status: string; reason: string | null }; count: number }>([{ $match: { storeId } }, { $group: { _id: { status: "$status", reason: { $ifNull: ["$unsubscribeReason", null] } }, count: { $sum: 1 } } }]).toArray(),
    broadcasts.countDocuments({ storeId }),
  ]);
  const subs = { subscribed: 0, unsubscribed: 0, bounced: 0, complained: 0 };
  for (const row of subRows) {
    if (row._id.status === "subscribed") subs.subscribed += row.count;
    else {
      subs.unsubscribed += row.count;
      if (row._id.reason === "bounced") subs.bounced += row.count;
      if (row._id.reason === "complained") subs.complained += row.count;
    }
  }
  return {
    id: doc._id,
    name: doc.name,
    slug: doc.slug,
    ownerEmail: emails.get(doc.ownerId) ?? "",
    isPublished: doc.isPublished,
    access: accessOf(doc, now),
    stripeConnected: doc.stripeChargesEnabled,
    createdAt: doc.createdAt,
    currency: doc.currency,
    trialEndsAt: doc.trialEndsAt ?? null,
    products: productDocs.map((product) => ({ id: product._id, title: product.title, type: product.type, status: product.status, priceCents: product.priceCents })),
    orders: {
      paid,
      sales: salesRows.map((row) => ({ currency: row._id, cents: row.cents })),
      recent: recent.map((order) => ({ id: order._id, title: order.item.title, buyerEmail: order.buyerEmail, totalCents: order.totalCents, currency: order.currency, status: order.status, createdAt: order.createdAt })),
    },
    subscribers: subs,
    broadcasts: broadcastCount,
  };
}

export type AdminOrderRow = { id: string; storeId: string; storeSlug: string; title: string; buyerEmail: string; totalCents: number; currency: string; status: string; provider: string; createdAt: Date };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Latest orders of all stores, by order id or the buyer's exact email (for support). */
export async function adminListOrders(options: { q?: string } = {}): Promise<AdminOrderRow[]> {
  const { orders, stores } = await collections();
  const q = options.q?.trim().slice(0, 200);
  const filter = q ? (UUID.test(q) ? { _id: q.toLowerCase() } : q.includes("@") ? { buyerEmail: q.toLowerCase() } : { "item.title": { $regex: escapeRegex(q), $options: "i" } }) : {};
  const docs = await orders.find({ ...filter, ...NOT_BUMP }, { projection: { storeId: 1, item: 1, buyerEmail: 1, totalCents: 1, currency: 1, status: 1, provider: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(PAGE).toArray();
  const slugs = new Map((await stores.find({ _id: { $in: [...new Set(docs.map((doc) => doc.storeId))] } }, { projection: { slug: 1 } }).toArray()).map((store) => [store._id, store.slug]));
  return docs.map((doc) => ({ id: doc._id, storeId: doc.storeId, storeSlug: slugs.get(doc.storeId) ?? "", title: doc.item.title, buyerEmail: doc.buyerEmail, totalCents: doc.totalCents, currency: doc.currency, status: doc.status, provider: doc.provider, createdAt: doc.createdAt }));
}

export type AdminProductRow = { id: string; storeId: string; storeSlug: string; title: string; type: string; status: string; priceCents: number; currency: string; slug: string; createdAt: Date };

/** Latest products of all stores, searchable by title. */
export async function adminListProducts(options: { q?: string } = {}): Promise<AdminProductRow[]> {
  const { products, stores } = await collections();
  const q = options.q?.trim().slice(0, 100);
  const docs = await products
    .find({ deletedAt: { $in: [null] }, ...(q ? { title: { $regex: escapeRegex(q), $options: "i" } } : {}) }, { projection: { storeId: 1, title: 1, type: 1, status: 1, priceCents: 1, slug: 1, createdAt: 1 } })
    .sort({ createdAt: -1 })
    .limit(PAGE)
    .toArray();
  const storeDocs = await stores.find({ _id: { $in: [...new Set(docs.map((doc) => doc.storeId))] } }, { projection: { slug: 1, currency: 1 } }).toArray();
  const byId = new Map(storeDocs.map((store) => [store._id, store]));
  return docs.map((doc) => ({ id: doc._id, storeId: doc.storeId, storeSlug: byId.get(doc.storeId)?.slug ?? "", title: doc.title, type: doc.type, status: doc.status, priceCents: doc.priceCents, currency: byId.get(doc.storeId)?.currency ?? "usd", slug: doc.slug, createdAt: doc.createdAt }));
}

export type AdminEmailStats = {
  broadcasts30: number;
  sent30: number;
  failed30: number;
  bounced: number;
  complained: number;
  topComplaints: { storeId: string; storeSlug: string; complained: number; bounced: number; subscribed: number }[];
  recent: { id: string; storeSlug: string; subject: string; status: string; sentCount: number; recipientCount: number; createdAt: Date }[];
};

/** Broadcasts and list health across stores: who gets bounces and spam complaints. */
export async function adminEmailStats(now: Date = new Date()): Promise<AdminEmailStats> {
  const { broadcasts, subscribers, stores } = await collections();
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const [counts, reasons, recentDocs] = await Promise.all([
    broadcasts.aggregate<{ _id: string; count: number; sent: number }>([{ $match: { createdAt: { $gte: since30 } } }, { $group: { _id: "$status", count: { $sum: 1 }, sent: { $sum: "$sentCount" } } }]).toArray(),
    subscribers
      .aggregate<{ _id: string; subscribed: number; bounced: number; complained: number }>([
        {
          $group: {
            _id: "$storeId",
            subscribed: { $sum: { $cond: [{ $eq: ["$status", "subscribed"] }, 1, 0] } },
            bounced: { $sum: { $cond: [{ $eq: ["$unsubscribeReason", "bounced"] }, 1, 0] } },
            complained: { $sum: { $cond: [{ $eq: ["$unsubscribeReason", "complained"] }, 1, 0] } },
          },
        },
        { $sort: { complained: -1, bounced: -1 } },
        { $limit: 200 },
      ])
      .toArray(),
    broadcasts.find({}, { projection: { storeId: 1, subject: 1, status: 1, sentCount: 1, recipientCount: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(20).toArray(),
  ]);
  const storeIds = [...new Set([...reasons.slice(0, 10).map((row) => row._id), ...recentDocs.map((doc) => doc.storeId)])];
  const slugs = new Map((await stores.find({ _id: { $in: storeIds } }, { projection: { slug: 1 } }).toArray()).map((store) => [store._id, store.slug]));
  return {
    broadcasts30: counts.reduce((sum, row) => sum + row.count, 0),
    sent30: counts.reduce((sum, row) => sum + row.sent, 0),
    failed30: counts.find((row) => row._id === "failed")?.count ?? 0,
    bounced: reasons.reduce((sum, row) => sum + row.bounced, 0),
    complained: reasons.reduce((sum, row) => sum + row.complained, 0),
    topComplaints: reasons
      .filter((row) => row.complained + row.bounced > 0)
      .slice(0, 10)
      .map((row) => ({ storeId: row._id, storeSlug: slugs.get(row._id) ?? "", complained: row.complained, bounced: row.bounced, subscribed: row.subscribed })),
    recent: recentDocs.map((doc) => ({ id: doc._id, storeSlug: slugs.get(doc.storeId) ?? "", subject: doc.subject, status: doc.status, sentCount: doc.sentCount, recipientCount: doc.recipientCount, createdAt: doc.createdAt })),
  };
}

export type AdminHealth = {
  webhooks24h: { source: string; count: number }[];
  stuckBroadcasts: number;
  pendingUploads: number;
  unpaidOrders24h: number;
  database: { dataMb: number; storageMb: number; collections: number } | null;
  imagesMb: number;
  auditRecent: { action: string; storeId: string | null; at: Date }[];
};

/** Signs that something needs attention, and storage use. */
export async function adminHealth(now: Date = new Date()): Promise<AdminHealth> {
  const { webhookEvents, broadcasts, files, orders, mediaBlobs, auditLogs } = await collections();
  const db = await getDb();
  const since24 = new Date(now.getTime() - DAY_MS);
  const [hooks, stuck, pending, unpaid, stats, images, audit] = await Promise.all([
    webhookEvents.aggregate<{ _id: string; count: number }>([{ $match: { processedAt: { $gte: since24 } } }, { $group: { _id: "$source", count: { $sum: 1 } } }]).toArray(),
    broadcasts.countDocuments({ status: "sending", updatedAt: { $lt: new Date(now.getTime() - 60 * 60 * 1000) } }),
    files.countDocuments({ status: "pending" }),
    orders.countDocuments({ status: { $in: ["pending", "failed"] }, createdAt: { $gte: since24 } }),
    db.stats().catch(() => null),
    mediaBlobs.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: "$size" } } }]).toArray(),
    auditLogs.find({}, { projection: { action: 1, storeId: 1, at: 1 } }).sort({ at: -1 }).limit(15).toArray(),
  ]);
  const mb = (bytes: unknown) => Math.round((Number(bytes) || 0) / 1024 / 1024);
  return {
    webhooks24h: hooks.map((row) => ({ source: row._id, count: row.count })),
    stuckBroadcasts: stuck,
    pendingUploads: pending,
    unpaidOrders24h: unpaid,
    database: stats ? { dataMb: mb(stats.dataSize), storageMb: mb(stats.storageSize), collections: Number(stats.collections) || 0 } : null,
    imagesMb: mb(images[0]?.total),
    auditRecent: audit.map((row) => ({ action: String(row.action), storeId: row.storeId, at: row.at })),
  };
}
