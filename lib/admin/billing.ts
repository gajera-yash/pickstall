import "server-only";

import { PLANNED_PRICE_CENTS, type PaidPlan } from "@/lib/config";
import { collections, type StoreBilling } from "@/lib/db/collections";

// Platform revenue for the admin (D-116): plan subscriptions and paid plan invoices on our own Stripe
// account. Read across all stores on purpose; only called after requireAdmin().

const DAY_MS = 24 * 60 * 60 * 1000;
/** Subscriptions that count towards MRR: paying now, or a payment being retried. */
const COUNTS_FOR_MRR = ["active", "past_due"];

export type CurrencyAmount = { currency: string; cents: number };

/** A subscription's price per month: yearly divided by 12, weekly and daily scaled; old rows use the planned price. */
export function monthlyCents(billing: Pick<StoreBilling, "plan" | "amountCents" | "interval">): number {
  const amount = billing.amountCents ?? (billing.plan ? PLANNED_PRICE_CENTS[billing.plan as PaidPlan] : 0);
  switch (billing.interval ?? "month") {
    case "year":
      return Math.round(amount / 12);
    case "week":
      return Math.round((amount * 52) / 12);
    case "day":
      return Math.round((amount * 365) / 12);
    default:
      return amount;
  }
}

function addTo(list: CurrencyAmount[], currency: string, cents: number) {
  const row = list.find((item) => item.currency === currency);
  if (row) row.cents += cents;
  else list.push({ currency, cents });
}

export type AdminBilling = {
  mrr: CurrencyAmount[];
  active: { starter: number; pro: number };
  pastDue: { storeId: string; name: string; slug: string; plan: string | null; since: Date }[];
  canceled30: number;
  newThisMonth: number;
  revenueThisMonth: CurrencyAmount[];
  revenueAll: CurrencyAmount[];
  /** Last 12 calendar months (UTC), oldest first, in USD (plans are priced in USD). */
  months: { label: string; cents: number }[];
  recent: { id: string; storeId: string | null; storeName: string; slug: string | null; plan: string | null; amountCents: number; currency: string; paidAt: Date }[];
  payments: number;
};

export async function adminBilling(now: Date = new Date()): Promise<AdminBilling> {
  const { stores, planPayments } = await collections();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

  const [subscribed, totals, thisMonth, byMonth, firsts, recent, payments] = await Promise.all([
    stores.find({ "billing.subscriptionId": { $type: "string" } }, { projection: { name: 1, slug: 1, billing: 1 } }).toArray(),
    planPayments.aggregate<{ _id: string; cents: number }>([{ $group: { _id: "$currency", cents: { $sum: "$amountCents" } } }]).toArray(),
    planPayments.aggregate<{ _id: string; cents: number }>([{ $match: { paidAt: { $gte: monthStart } } }, { $group: { _id: "$currency", cents: { $sum: "$amountCents" } } }]).toArray(),
    planPayments
      .aggregate<{ _id: string; cents: number }>([
        { $match: { paidAt: { $gte: yearStart }, currency: "usd" } },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$paidAt", timezone: "UTC" } }, cents: { $sum: "$amountCents" } } },
      ])
      .toArray(),
    // A store's first plan payment: "new subscriptions this month".
    planPayments.aggregate<{ _id: string; first: Date }>([{ $match: { storeId: { $type: "string" } } }, { $group: { _id: "$storeId", first: { $min: "$paidAt" } } }, { $match: { first: { $gte: monthStart } } }]).toArray(),
    planPayments.find({}).sort({ paidAt: -1 }).limit(25).toArray(),
    planPayments.estimatedDocumentCount(),
  ]);

  const result: AdminBilling = {
    mrr: [],
    active: { starter: 0, pro: 0 },
    pastDue: [],
    canceled30: 0,
    newThisMonth: firsts.length,
    revenueThisMonth: thisMonth.map((row) => ({ currency: row._id, cents: row.cents })),
    revenueAll: totals.map((row) => ({ currency: row._id, cents: row.cents })),
    months: [],
    recent: [],
    payments,
  };

  for (const store of subscribed) {
    const billing = store.billing;
    if (!billing) continue;
    if (COUNTS_FOR_MRR.includes(billing.status)) {
      addTo(result.mrr, billing.currency ?? "usd", monthlyCents(billing));
      if (billing.plan === "starter" || billing.plan === "pro") result.active[billing.plan] += 1;
    }
    if (billing.status === "past_due" || billing.status === "unpaid") result.pastDue.push({ storeId: store._id, name: store.name, slug: store.slug, plan: billing.plan, since: billing.updatedAt });
    if (billing.status === "canceled" && now.getTime() - billing.updatedAt.getTime() <= 30 * DAY_MS) result.canceled30 += 1;
  }

  const monthCents = new Map(byMonth.map((row) => [row._id, row.cents]));
  for (let back = 11; back >= 0; back -= 1) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const key = month.toISOString().slice(0, 7);
    result.months.push({ label: new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" }).format(month), cents: monthCents.get(key) ?? 0 });
  }

  const storeIds = [...new Set(recent.map((row) => row.storeId).filter((id): id is string => typeof id === "string"))];
  const names = new Map((await stores.find({ _id: { $in: storeIds } }, { projection: { name: 1, slug: 1 } }).toArray()).map((store) => [store._id, store]));
  result.recent = recent.map((row) => {
    const store = row.storeId ? names.get(row.storeId) : undefined;
    return { id: row._id, storeId: row.storeId, storeName: store?.name ?? "Unknown store", slug: store?.slug ?? null, plan: row.plan, amountCents: row.amountCents, currency: row.currency, paidAt: row.paidAt };
  });
  return result;
}

/** Plan payments for the admin CSV (D-116), newest first, at most 5,000, with the store's name. */
export async function planPaymentsForExport(): Promise<{ id: string; paidAt: Date; storeName: string; slug: string; plan: string; amountCents: number; currency: string }[]> {
  const { planPayments, stores } = await collections();
  const rows = await planPayments.find({}).sort({ paidAt: -1 }).limit(5000).toArray();
  const ids = [...new Set(rows.map((row) => row.storeId).filter((id): id is string => typeof id === "string"))];
  const names = new Map((await stores.find({ _id: { $in: ids } }, { projection: { name: 1, slug: 1 } }).toArray()).map((store) => [store._id, store]));
  return rows.map((row) => {
    const store = row.storeId ? names.get(row.storeId) : undefined;
    return { id: row._id, paidAt: row.paidAt, storeName: store?.name ?? "", slug: store?.slug ?? "", plan: row.plan ?? "", amountCents: row.amountCents, currency: row.currency };
  });
}
