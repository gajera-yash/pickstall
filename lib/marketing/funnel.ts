import "server-only";

import { DIRECT_SOURCE } from "@/lib/analytics/attribution";
import { collections } from "@/lib/db/collections";

// The creator funnel (D-119), for the platform admin and the daily marketing report. A cohort is
// every store created in the period; each step counts the cohort stores that ever reached it.
// Platform-wide data: call only behind requireAdmin (or from a server job), never with client input.

const DAY_MS = 24 * 60 * 60 * 1000;

export type FunnelCounts = { signups: number; published: number; paymentConnected: number; firstSale: number; paidPlan: number };

export type CreatorFunnel = { since: Date; days: number; total: FunnelCounts; bySource: ({ source: string } & FunnelCounts)[] };

/** One cohort store with the steps it reached. */
export type FunnelRow = { source: string; published: boolean; paymentConnected: boolean; firstSale: boolean; paidPlan: boolean };

const MAX_SOURCES = 20;

function emptyCounts(): FunnelCounts {
  return { signups: 0, published: 0, paymentConnected: 0, firstSale: 0, paidPlan: 0 };
}

function add(counts: FunnelCounts, row: FunnelRow): void {
  counts.signups += 1;
  if (row.published) counts.published += 1;
  if (row.paymentConnected) counts.paymentConnected += 1;
  if (row.firstSale) counts.firstSale += 1;
  if (row.paidPlan) counts.paidPlan += 1;
}

/** Totals and per-source counts (most signups first, at most 20 sources; ties by name). */
export function summarizeFunnel(rows: FunnelRow[]): Pick<CreatorFunnel, "total" | "bySource"> {
  const total = emptyCounts();
  const bySource = new Map<string, FunnelCounts>();
  for (const row of rows) {
    add(total, row);
    const counts = bySource.get(row.source) ?? emptyCounts();
    add(counts, row);
    bySource.set(row.source, counts);
  }
  const sources = [...bySource.entries()]
    .map(([source, counts]) => ({ source, ...counts }))
    .sort((a, b) => b.signups - a.signups || a.source.localeCompare(b.source))
    .slice(0, MAX_SOURCES);
  return { total, bySource: sources };
}

/**
 * The funnel of creators who signed up in the last `days` days. Steps: store published (first
 * publish date, or published now for stores from before D-119), payments connected (PayPal now or
 * ever, or Stripe charges on), a first real sale (a paid or later refunded order above 0, not a bump
 * and not the development mock), and a paid Pickstall plan (any plan payment above 0).
 */
export async function creatorFunnel(days: number, now: Date = new Date()): Promise<CreatorFunnel> {
  const since = new Date(now.getTime() - days * DAY_MS);
  const { stores, orders, auditLogs, planPayments } = await collections();
  const cohort = await stores
    .find(
      { createdAt: { $gte: since, $lte: now } },
      { projection: { _id: 1, isPublished: 1, publishedAt: 1, "acquisition.source": 1, "paypal.connectedAt": 1, stripeChargesEnabled: 1 } },
    )
    .toArray();
  if (cohort.length === 0) return { since, days, total: emptyCounts(), bySource: [] };

  const ids = cohort.map((store) => store._id);
  const [connectedEver, sold, planned] = await Promise.all([
    auditLogs.distinct("storeId", { action: "paypal.connected", storeId: { $in: ids } }),
    orders.distinct("storeId", { storeId: { $in: ids }, status: { $in: ["paid", "refunded"] }, totalCents: { $gt: 0 }, provider: { $ne: "mock" }, bumpOf: { $in: [null] } }),
    planPayments.distinct("storeId", { storeId: { $in: ids }, amountCents: { $gt: 0 } }),
  ]);
  const connectedSet = new Set(connectedEver);
  const soldSet = new Set(sold);
  const plannedSet = new Set(planned);

  const rows: FunnelRow[] = cohort.map((store) => ({
    source: store.acquisition?.source ?? DIRECT_SOURCE,
    published: Boolean(store.publishedAt) || store.isPublished,
    paymentConnected: Boolean(store.paypal?.connectedAt) || store.stripeChargesEnabled === true || connectedSet.has(store._id),
    firstSale: soldSet.has(store._id),
    paidPlan: plannedSet.has(store._id),
  }));
  return { since, days, ...summarizeFunnel(rows) };
}
