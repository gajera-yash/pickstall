import "server-only";

import { randomUUID } from "node:crypto";

import { collections, type MktDraftDoc, type MktLeadDoc } from "@/lib/db/collections";
import type { DraftInput, DraftWriter } from "@/lib/marketing/ai/types";
import { configuredWriter, writeDraft } from "@/lib/marketing/ai/writer";
import { followerBand, leadFit, type Fit } from "@/lib/marketing/fit";
import { DEFAULT_GROWTH_SETTINGS, FOLLOW_UP_AFTER_DAYS, firstNameOf, type GrowthSettings } from "@/lib/marketing/growth-settings-rules";

// DM drafts, the Today queue and follow-ups (D-121). Platform-wide data: called only behind
// requireAdmin (lib/marketing/draft-actions.ts and the Growth pages).

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getGrowthSettings(): Promise<GrowthSettings> {
  const { mktSettings } = await collections();
  const doc = await mktSettings.findOne({ _id: "settings" });
  return {
    voiceExamples: doc?.voiceExamples ?? DEFAULT_GROWTH_SETTINGS.voiceExamples,
    dailyDraftLimit: doc?.dailyDraftLimit ?? DEFAULT_GROWTH_SETTINGS.dailyDraftLimit,
    dailyContactTarget: doc?.dailyContactTarget ?? DEFAULT_GROWTH_SETTINGS.dailyContactTarget,
  };
}

/** Saves already-cleaned settings (growthSettingsInput). */
export async function saveGrowthSettings(settings: GrowthSettings, now: Date = new Date()): Promise<void> {
  const { mktSettings } = await collections();
  await mktSettings.updateOne({ _id: "settings" }, { $set: { ...settings, updatedAt: now } }, { upsert: true });
}

/** What the writer gets for a lead: no handle, no notes, followers only as a range. */
export function draftInputFor(lead: Pick<MktLeadDoc, "name" | "topic" | "tool" | "toolLabel" | "followers" | "country">, voiceExamples: string[]): DraftInput {
  return {
    firstName: firstNameOf(lead.name),
    topic: lead.topic,
    tool: lead.tool,
    toolLabel: lead.toolLabel,
    followerBand: followerBand(lead.followers),
    country: lead.country,
    voiceExamples,
  };
}

export async function draftsWrittenToday(now: Date = new Date()): Promise<number> {
  const { mktDrafts } = await collections();
  return mktDrafts.countDocuments({ createdAt: { $gte: startOfUtcDay(now) } });
}

export type CreateDraftResult = { ok: true; draft: MktDraftDoc } | { ok: false; reason: "not_found" | "do_not_contact" | "limit" };

/** Writes and saves a new draft for a lead, within the daily draft limit. */
export async function createDraft(leadId: string, actor: string, now: Date = new Date(), writer: DraftWriter = configuredWriter()): Promise<CreateDraftResult> {
  const { mktLeads, mktDrafts, mktEvents } = await collections();
  const lead = await mktLeads.findOne({ _id: leadId });
  if (!lead) return { ok: false, reason: "not_found" };
  if (lead.stage === "do_not_contact") return { ok: false, reason: "do_not_contact" };
  const settings = await getGrowthSettings();
  if ((await draftsWrittenToday(now)) >= settings.dailyDraftLimit) return { ok: false, reason: "limit" };

  const written = await writeDraft(draftInputFor(lead, settings.voiceExamples), writer);
  const draft: MktDraftDoc = { _id: randomUUID(), leadId, firstMessage: written.firstMessage, followUp: written.followUp, writer: written.writer, model: written.model, note: written.note, createdAt: now };
  await mktDrafts.insertOne(draft);
  await mktEvents.insertOne({ _id: randomUUID(), leadId, type: "draft_written", from: null, to: written.writer, actor, at: now });
  return { ok: true, draft };
}

/** The newest draft of each lead. */
export async function latestDrafts(leadIds: string[]): Promise<Map<string, MktDraftDoc>> {
  const result = new Map<string, MktDraftDoc>();
  if (leadIds.length === 0) return result;
  const { mktDrafts } = await collections();
  const rows = await mktDrafts
    .aggregate<{ _id: string; draft: MktDraftDoc }>([{ $match: { leadId: { $in: leadIds } } }, { $sort: { createdAt: -1 } }, { $group: { _id: "$leadId", draft: { $first: "$$ROOT" } } }])
    .toArray();
  for (const row of rows) result.set(row._id, row.draft);
  return result;
}

export type QueueLead = Pick<MktLeadDoc, "_id" | "name" | "handle" | "platform" | "followers" | "country" | "topic" | "tool" | "toolLabel" | "stage" | "lastContactedAt" | "followUpSentAt"> & {
  fit: Fit;
  draft: MktDraftDoc | null;
};

export type TodayQueue = {
  toContact: QueueLead[];
  contactedToday: number;
  followUps: QueueLead[];
  noReply: QueueLead[];
  draftsToday: number;
  settings: GrowthSettings;
};

const QUEUE_FIELDS = { _id: 1, name: 1, handle: 1, platform: 1, followers: 1, country: 1, topic: 1, tool: 1, toolLabel: 1, stage: 1, lastContactedAt: 1, followUpSentAt: 1 } as const;

/**
 * Today's work: the best-fitting new leads up to the daily target (minus those already contacted
 * today), contacted leads whose one follow-up is due (4 days without a reply), and leads with no
 * reply 4 days after the follow-up (a suggestion to close them; nothing changes on its own).
 */
export async function todayQueue(now: Date = new Date()): Promise<TodayQueue> {
  const { mktLeads, mktEvents } = await collections();
  const settings = await getGrowthSettings();
  const dueBefore = new Date(now.getTime() - FOLLOW_UP_AFTER_DAYS * DAY_MS);
  const [newLeads, contactedTodayIds, followUps, noReply, draftsToday] = await Promise.all([
    mktLeads.find({ stage: "new" }, { projection: QUEUE_FIELDS }).limit(20_000).toArray(),
    mktEvents.distinct("leadId", { type: "contacted", at: { $gte: startOfUtcDay(now) } }),
    mktLeads.find({ stage: "contacted", lastContactedAt: { $lte: dueBefore }, followUpSentAt: { $exists: false } }, { projection: QUEUE_FIELDS }).sort({ lastContactedAt: 1 }).limit(50).toArray(),
    mktLeads.find({ stage: "contacted", followUpSentAt: { $lte: dueBefore } }, { projection: QUEUE_FIELDS }).sort({ followUpSentAt: 1 }).limit(20).toArray(),
    draftsWrittenToday(now),
  ]);

  const remaining = Math.max(0, settings.dailyContactTarget - contactedTodayIds.length);
  const ranked = newLeads
    .map((lead) => ({ lead, fit: leadFit(lead) }))
    .sort((a, b) => b.fit.score - a.fit.score || (b.lead.followers ?? -1) - (a.lead.followers ?? -1) || a.lead._id.localeCompare(b.lead._id))
    .slice(0, remaining);
  const drafts = await latestDrafts([...ranked.map(({ lead }) => lead._id), ...followUps.map((lead) => lead._id)]);
  const withFit = (lead: (typeof followUps)[number]): QueueLead => ({ ...lead, fit: leadFit(lead), draft: drafts.get(lead._id) ?? null });

  return {
    toContact: ranked.map(({ lead, fit }) => ({ ...lead, fit, draft: drafts.get(lead._id) ?? null })),
    contactedToday: contactedTodayIds.length,
    followUps: followUps.map(withFit),
    noReply: noReply.map(withFit),
    draftsToday,
    settings,
  };
}

/** Notes that the one follow-up was sent. False when the lead is missing, already followed up, or not "contacted". */
export async function markFollowUpSent(leadId: string, actor: string, now: Date = new Date()): Promise<boolean> {
  const { mktLeads, mktEvents } = await collections();
  const result = await mktLeads.updateOne({ _id: leadId, stage: "contacted", followUpSentAt: { $exists: false } }, { $set: { followUpSentAt: now, updatedAt: now } });
  if (result.modifiedCount === 0) return false;
  await mktEvents.insertOne({ _id: randomUUID(), leadId, type: "followed_up", from: null, to: null, actor, at: now });
  return true;
}

/** Which writer drafts are coming from, for the Settings and Today screens. */
export function writerStatus(): { name: "template" | "groq"; model: string | null } {
  const writer = configuredWriter();
  return { name: writer.name, model: writer.model };
}
