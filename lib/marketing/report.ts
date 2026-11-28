import "server-only";

import { DIRECT_SOURCE } from "@/lib/analytics/attribution";
import { collections } from "@/lib/db/collections";
import { CONTENT_PLATFORMS, CONTENT_PLATFORM_LABELS } from "@/lib/marketing/content/rules";
import { getGrowthSettings } from "@/lib/marketing/drafts";
import { FOLLOW_UP_AFTER_DAYS } from "@/lib/marketing/growth-settings-rules";
import { LEAD_STAGE_LABELS, type LeadStage } from "@/lib/marketing/leads-rules";
import { DAY_MS, istDate, tomorrowPriorities, type ReportWindow } from "@/lib/marketing/report-rules";
import type { DailyReportData, ReportContent, ReportMovement, ReportTrendDay } from "@/lib/marketing/report-types";

// The daily growth report's numbers (D-122), all read from the database for one window
// (21:00 IST to 21:00 IST). Platform-wide data: used only by the report job and admin pages.

const REPLY_STAGES: LeadStage[] = ["replied", "interested", "call_booked"];
const CLOSED_STAGES: LeadStage[] = ["not_interested", "do_not_contact"];
const MAX_MOVEMENTS = 20;
const MAX_SOURCES = 8;
const REAL_SALE = { status: { $in: ["paid", "refunded"] as ("paid" | "refunded")[] }, totalCents: { $gt: 0 }, provider: { $ne: "mock" as const }, bumpOf: { $in: [null] } };

type Range = { $gte: Date; $lt: Date };
const inRange = (window: Pick<ReportWindow, "start" | "end">): Range => ({ $gte: window.start, $lt: window.end });

/** Stores whose first real sale (or first plan payment) falls in the window. */
async function firstsInWindow(range: Range): Promise<{ firstSales: number; paidPlans: number }> {
  const { orders, planPayments } = await collections();
  const [soldNow, plannedNow] = await Promise.all([
    orders.distinct("storeId", { ...REAL_SALE, paidAt: range }),
    planPayments.distinct("storeId", { amountCents: { $gt: 0 }, paidAt: range }),
  ]);
  const plannedIds = plannedNow.filter((id): id is string => typeof id === "string");
  const [soldBefore, plannedBefore] = await Promise.all([
    soldNow.length ? orders.distinct("storeId", { ...REAL_SALE, storeId: { $in: soldNow }, paidAt: { $lt: range.$gte } }) : Promise.resolve([] as string[]),
    plannedIds.length ? planPayments.distinct("storeId", { amountCents: { $gt: 0 }, storeId: { $in: plannedIds }, paidAt: { $lt: range.$gte } }) : Promise.resolve([] as (string | null)[]),
  ]);
  return { firstSales: soldNow.length - new Set(soldBefore).size, paidPlans: plannedIds.length - new Set(plannedBefore).size };
}

/** DMs, replies and signups for each of the last 7 report days, oldest first. */
async function weekTrend(window: ReportWindow): Promise<ReportTrendDay[]> {
  const { mktEvents, stores } = await collections();
  const days: ReportTrendDay[] = [];
  const lastStart = window.start;
  for (let back = 6; back >= 0; back -= 1) {
    const start = new Date(lastStart.getTime() - back * DAY_MS);
    const end = back === 0 ? window.end : new Date(start.getTime() + DAY_MS);
    const range = { $gte: start, $lt: end };
    const [dms, replies, signups] = await Promise.all([
      mktEvents.countDocuments({ type: "contacted", at: range }),
      mktEvents.countDocuments({ type: "stage_changed", to: { $in: REPLY_STAGES }, at: range }),
      stores.countDocuments({ createdAt: range }),
    ]);
    days.push({ day: istDate(new Date(start.getTime() + DAY_MS)), dms, replies, signups });
  }
  return days;
}

/** The report day's social posts (D-136): written, posted (and where), skipped, still not posted. */
async function contentOfDay(day: string): Promise<ReportContent> {
  const { mktPosts } = await collections();
  const posts = await mktPosts.find({ day }, { projection: { platform: 1, status: 1 } }).toArray();
  const posted = posts.filter((post) => post.status === "posted");
  return {
    written: posts.length,
    posted: posted.length,
    skipped: posts.filter((post) => post.status === "skipped").length,
    notPosted: posts.filter((post) => post.status === "draft").length,
    postedOn: CONTENT_PLATFORMS.filter((platform) => posted.some((post) => post.platform === platform)).map((platform) => CONTENT_PLATFORM_LABELS[platform]),
  };
}

/** Builds the report for a window. */
export async function buildDailyReport(window: ReportWindow): Promise<DailyReportData> {
  const { mktEvents, mktLeads, mktDrafts, stores, auditLogs } = await collections();
  const range = inRange(window);
  const settings = await getGrowthSettings();

  const [events, newStores, published, connected, firsts, trend, followUpsDue, repliesWaiting, stuckSignups, aiFallbacks, newLeadsLeft] = await Promise.all([
    mktEvents.find({ at: range, type: { $in: ["imported", "contacted", "followed_up", "stage_changed", "draft_written"] } }, { projection: { leadId: 1, type: 1, to: 1, at: 1 } }).sort({ at: -1 }).limit(20_000).toArray(),
    stores.find({ createdAt: range }, { projection: { _id: 1, "acquisition.source": 1, "acquisition.ref": 1, createdAt: 1 } }).toArray(),
    stores.countDocuments({ publishedAt: range }),
    auditLogs.distinct("storeId", { action: "paypal.connected", at: range }),
    firstsInWindow(range),
    weekTrend(window),
    mktLeads.countDocuments({ stage: "contacted", lastContactedAt: { $lte: new Date(window.end.getTime() - FOLLOW_UP_AFTER_DAYS * DAY_MS) }, followUpSentAt: { $exists: false } }),
    mktLeads.countDocuments({ stage: "replied", stageChangedAt: { $lte: new Date(window.end.getTime() - DAY_MS) } }),
    stores.countDocuments({ createdAt: { $gte: new Date(window.end.getTime() - 14 * DAY_MS), $lte: new Date(window.end.getTime() - DAY_MS) }, isPublished: false, publishedAt: { $exists: false }, deletedAt: { $exists: false } }),
    mktDrafts.countDocuments({ createdAt: range, note: { $type: "string" } }),
    mktLeads.countDocuments({ stage: "new" }),
  ]);

  const count = (predicate: (event: (typeof events)[number]) => boolean) => events.filter(predicate).length;
  const outreach = {
    dmsSent: count((event) => event.type === "contacted"),
    followUpsSent: count((event) => event.type === "followed_up"),
    replies: count((event) => event.type === "stage_changed" && REPLY_STAGES.includes(event.to as LeadStage)),
    closed: count((event) => event.type === "stage_changed" && CLOSED_STAGES.includes(event.to as LeadStage)),
    draftsAi: count((event) => event.type === "draft_written" && event.to !== "template"),
    draftsTemplate: count((event) => event.type === "draft_written" && event.to === "template"),
    imported: count((event) => event.type === "imported"),
  };

  const bySource = new Map<string, number>();
  for (const store of newStores) {
    const source = store.acquisition?.source ?? DIRECT_SOURCE;
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
  }
  const funnel = {
    signups: newStores.length,
    signupsBySource: [...bySource.entries()]
      .map(([source, value]) => ({ source, count: value }))
      .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
      .slice(0, MAX_SOURCES),
    published,
    paymentConnected: connected.length,
    ...firsts,
  };

  // Who moved today: lead events (not drafts or imports), and leads who signed up through their link.
  const refs = newStores.map((store) => store.acquisition?.ref).filter((ref): ref is string => Boolean(ref));
  const moving = events.filter((event) => event.type === "contacted" || event.type === "followed_up" || event.type === "stage_changed");
  const leadIds = [...new Set(moving.map((event) => event.leadId))];
  const leads = await mktLeads
    .find({ $or: [{ _id: { $in: leadIds } }, ...(refs.length ? [{ refCode: { $in: refs } }] : [])] }, { projection: { _id: 1, name: 1, handle: 1, refCode: 1 } })
    .toArray();
  const byId = new Map(leads.map((lead) => [lead._id, lead]));
  const byRef = new Map(leads.map((lead) => [lead.refCode, lead]));
  const who = (lead: { name: string | null; handle: string }) => lead.name ?? `@${lead.handle}`;
  const movements: ReportMovement[] = [];
  for (const store of newStores) {
    const lead = store.acquisition?.ref ? byRef.get(store.acquisition.ref) : undefined;
    if (lead) movements.push({ leadId: lead._id, who: who(lead), what: "signed up through their link", at: store.createdAt.toISOString() });
  }
  for (const event of moving) {
    const lead = byId.get(event.leadId);
    if (!lead) continue;
    const what = event.type === "contacted" ? "messaged" : event.type === "followed_up" ? "follow-up sent" : `moved to ${LEAD_STAGE_LABELS[event.to as LeadStage] ?? event.to}`;
    movements.push({ leadId: lead._id, who: who(lead), what, at: event.at.toISOString() });
  }
  movements.sort((a, b) => b.at.localeCompare(a.at));

  const attention = { followUpsDue, repliesWaiting, stuckSignups, aiFallbacks };
  return {
    content: await contentOfDay(window.day),
    outreach,
    funnel,
    movements: movements.slice(0, MAX_MOVEMENTS),
    trend,
    attention,
    priorities: tomorrowPriorities({ repliesWaiting, followUpsDue, stuckSignups, newLeadsLeft, dailyContactTarget: settings.dailyContactTarget }),
  };
}
