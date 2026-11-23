import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { MongoBulkWriteError, type AnyBulkWriteOperation, type Filter } from "mongodb";

import { collections, type MktEventDoc, type MktLeadDoc, type StoreDoc } from "@/lib/db/collections";
import { STEP_FIELDS, storeSteps, type StoreSteps } from "@/lib/marketing/funnel";
import {
  LEAD_STAGES,
  cleanLeadNotes,
  cleanLeadRow,
  leadHandleKey,
  leadProfileUrl,
  stageGuess,
  type LeadImportPayload,
  type LeadPlatform,
  type LeadStage,
  type LeadTool,
} from "@/lib/marketing/leads-rules";
import { escapeRegex } from "@/lib/orders/csv";
import { handleFromUrl, isHandleKind } from "@/lib/stores/social-handles";

// Outreach leads (D-120): the founder's own list of creators to contact. Platform-wide data: every
// function here is called only behind requireAdmin (lib/marketing/lead-actions.ts and the Growth
// pages). Signing up and later steps are read live from the creator's store, never stored on the lead.

export const LEADS_PAGE_SIZE = 50;

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** A random 8-character `?ref=` code (31^8 values), never derived from the handle. */
export function newRefCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

/** The suppression key of a lead: SHA-256 of its handle key, so nothing readable is kept. */
export function suppressionId(handleKey: string): string {
  return createHash("sha256").update(handleKey).digest("hex");
}

export type LeadImportSummary = { added: number; existing: number; suppressed: number; invalid: number; invalidRows: number[]; failed: number };

const MAX_INVALID_ROWS_SHOWN = 20;

/**
 * Adds the rows of one import part. Rows without a valid handle are counted with their file row
 * number; a handle already in the list (or twice in the file) is left as it is; a suppressed handle
 * (deleted or "do not contact") is never added again. New leads get a random `?ref=` code.
 */
export async function importLeads(input: Pick<LeadImportPayload, "rows" | "statusMap" | "fileName" | "firstRow">, actor: string, now: Date = new Date()): Promise<LeadImportSummary> {
  const summary: LeadImportSummary = { added: 0, existing: 0, suppressed: 0, invalid: 0, invalidRows: [], failed: 0 };
  const statusMap = input.statusMap as Record<string, LeadStage>;
  const stageFor = (status: string): LeadStage => statusMap[status.toLowerCase()] ?? stageGuess(status);
  const fileName = input.fileName.replace(/[^\w .()-]/g, "").slice(0, 120) || null;

  const docs: MktLeadDoc[] = [];
  const seen = new Set<string>();
  input.rows.forEach((raw, index) => {
    const row = cleanLeadRow(raw, stageFor);
    if (!row) {
      summary.invalid += 1;
      if (summary.invalidRows.length < MAX_INVALID_ROWS_SHOWN) summary.invalidRows.push(input.firstRow + index);
      return;
    }
    const handleKey = leadHandleKey(row.platform, row.handle);
    if (seen.has(handleKey)) {
      summary.existing += 1;
      return;
    }
    seen.add(handleKey);
    docs.push({ _id: randomUUID(), ...row, handleKey, refCode: newRefCode(), importedFrom: fileName, lastContactedAt: null, stageChangedAt: now, createdAt: now, updatedAt: now });
  });
  if (docs.length === 0) return summary;

  const { mktLeads, mktEvents, mktSuppressions } = await collections();
  const blocked = new Set((await mktSuppressions.find({ _id: { $in: docs.map((doc) => suppressionId(doc.handleKey)) } }, { projection: { _id: 1 } }).toArray()).map((row) => row._id));
  const allowed = docs.filter((doc) => !blocked.has(suppressionId(doc.handleKey)));
  summary.suppressed = docs.length - allowed.length;
  if (allowed.length === 0) return summary;

  const operations: AnyBulkWriteOperation<MktLeadDoc>[] = allowed.map((doc) => ({ updateOne: { filter: { handleKey: doc.handleKey }, update: { $setOnInsert: doc }, upsert: true } }));
  let upserted: Record<number, unknown> = {};
  let errors = 0;
  try {
    const result = await mktLeads.bulkWrite(operations, { ordered: false });
    upserted = result.upsertedIds;
  } catch (error) {
    if (!(error instanceof MongoBulkWriteError)) throw error;
    upserted = error.result.upsertedIds;
    errors = Array.isArray(error.writeErrors) ? error.writeErrors.length : 1;
  }
  const addedDocs = Object.keys(upserted).map((index) => allowed[Number(index)]).filter((doc): doc is MktLeadDoc => Boolean(doc));
  summary.added = addedDocs.length;
  summary.failed = errors;
  summary.existing += allowed.length - addedDocs.length - errors;
  if (addedDocs.length > 0) {
    await mktEvents.insertMany(addedDocs.map((doc) => ({ _id: randomUUID(), leadId: doc._id, type: "imported" as const, from: null, to: doc.stage, actor, at: now })));
  }
  return summary;
}

/** The creator's store a lead signed up with: by their own link, or by the same profile on the store. */
export type LeadStore = { storeId: string; slug: string; via: "link" | "profile"; signedUpAt: Date; steps: StoreSteps };

type LinkableLead = Pick<MktLeadDoc, "_id" | "refCode" | "platform" | "handle">;
type LinkStore = Pick<StoreDoc, "_id" | "slug" | "createdAt" | "isPublished" | "publishedAt" | "paypal" | "stripeChargesEnabled" | "acquisition" | "socialLinks">;

const LINK_FIELDS = { ...STEP_FIELDS, slug: 1, createdAt: 1, "acquisition.ref": 1, socialLinks: 1 } as const;

/** Profile links a store could show for a lead, as the store settings save them (D-046). */
function profileUrlsOf(lead: Pick<MktLeadDoc, "platform" | "handle">): string[] {
  const url = leadProfileUrl(lead.platform, lead.handle);
  return url ? [url] : [];
}

/** The store each lead signed up with, if any. A signup through the lead's own link wins over a profile match. */
export async function linkedStores(leads: LinkableLead[]): Promise<Map<string, LeadStore>> {
  const result = new Map<string, LeadStore>();
  if (leads.length === 0) return result;
  const { stores } = await collections();
  const codes = leads.map((lead) => lead.refCode);
  const urls = leads.flatMap(profileUrlsOf);
  const found = (await stores
    .find({ deletedAt: { $exists: false }, $or: [{ "acquisition.ref": { $in: codes } }, ...(urls.length ? [{ "socialLinks.url": { $in: urls } }] : [])] }, { projection: LINK_FIELDS })
    .toArray()) as LinkStore[];
  if (found.length === 0) return result;

  const byRef = new Map<string, LinkStore>();
  const byProfile = new Map<string, LinkStore>();
  for (const store of found) {
    if (store.acquisition?.ref) byRef.set(store.acquisition.ref, store);
    for (const link of store.socialLinks ?? []) {
      if (!isHandleKind(link.kind)) continue;
      const handle = handleFromUrl(link.kind, link.url)?.toLowerCase();
      if (handle && !byProfile.has(leadHandleKey(link.kind as LeadPlatform, handle))) byProfile.set(leadHandleKey(link.kind as LeadPlatform, handle), store);
    }
  }
  const steps = await storeSteps(found);
  for (const lead of leads) {
    const viaLink = byRef.get(lead.refCode);
    const store = viaLink ?? byProfile.get(leadHandleKey(lead.platform, lead.handle));
    if (!store) continue;
    const reached = steps.get(store._id);
    if (!reached) continue;
    result.set(lead._id, { storeId: store._id, slug: store.slug, via: viaLink ? "link" : "profile", signedUpAt: store.createdAt, steps: reached });
  }
  return result;
}

export type LeadFilters = { stage?: LeadStage | "signed_up"; tool?: LeadTool; topic?: string; country?: string; q?: string; page: number };

export type LeadRow = Pick<MktLeadDoc, "_id" | "platform" | "handle" | "name" | "followers" | "country" | "topic" | "tool" | "toolLabel" | "stage" | "refCode" | "lastContactedAt"> & { store: LeadStore | null };

export type LeadCounts = { total: number; byStage: Record<LeadStage, number>; signedUp: number; live: number; firstSale: number; paidPlan: number };

export type LeadList = { rows: LeadRow[]; hasMore: boolean; counts: LeadCounts; topics: string[]; countries: string[] };

const ROW_FIELDS = { _id: 1, platform: 1, handle: 1, name: 1, followers: 1, country: 1, topic: 1, tool: 1, toolLabel: 1, stage: 1, refCode: 1, lastContactedAt: 1 } as const;

/** Every lead's signup state, for the counts and the "Signed up" filter. */
async function allLinks(): Promise<{ links: Map<string, LeadStore>; total: number }> {
  const { mktLeads } = await collections();
  const all = await mktLeads.find({}, { projection: { _id: 1, refCode: 1, platform: 1, handle: 1 } }).toArray();
  return { links: await linkedStores(all), total: all.length };
}

/** One page of leads (most followers first) with the list's counts and filter choices. */
export async function listLeads(filters: LeadFilters): Promise<LeadList> {
  const { mktLeads } = await collections();
  const { links, total } = await allLinks();

  const query: Filter<MktLeadDoc> = {};
  if (filters.stage === "signed_up") query._id = { $in: [...links.keys()] };
  else if (filters.stage) query.stage = filters.stage;
  if (filters.tool) query.tool = filters.tool;
  if (filters.topic) query.topic = filters.topic;
  if (filters.country) query.country = filters.country;
  if (filters.q) {
    const pattern = new RegExp(escapeRegex(filters.q.replace(/^@/, "")), "i");
    query.$or = [{ name: pattern }, { handle: pattern }];
  }

  const page = Math.max(0, Math.min(filters.page, 1_000));
  const [found, stageRows, topics, countries] = await Promise.all([
    mktLeads
      .find(query, { projection: ROW_FIELDS })
      .sort({ followers: -1, _id: 1 })
      .skip(page * LEADS_PAGE_SIZE)
      .limit(LEADS_PAGE_SIZE + 1)
      .toArray(),
    mktLeads.aggregate<{ _id: LeadStage; count: number }>([{ $group: { _id: "$stage", count: { $sum: 1 } } }]).toArray(),
    mktLeads.distinct("topic", { topic: { $type: "string" } }),
    mktLeads.distinct("country", { country: { $type: "string" } }),
  ]);

  const byStage = Object.fromEntries(LEAD_STAGES.map((stage) => [stage, 0])) as Record<LeadStage, number>;
  for (const row of stageRows) if (row._id in byStage) byStage[row._id] = row.count;
  const linked = [...links.values()];
  const counts: LeadCounts = {
    total,
    byStage,
    signedUp: linked.length,
    live: linked.filter((link) => link.steps.published).length,
    firstSale: linked.filter((link) => link.steps.firstSale).length,
    paidPlan: linked.filter((link) => link.steps.paidPlan).length,
  };
  const rows = found.slice(0, LEADS_PAGE_SIZE).map((lead) => ({ ...lead, store: links.get(lead._id) ?? null }));
  const sortText = (values: (string | null)[]) => values.filter((value): value is string => Boolean(value)).sort((a, b) => a.localeCompare(b)).slice(0, 200);
  return { rows, hasMore: found.length > LEADS_PAGE_SIZE, counts, topics: sortText(topics), countries: sortText(countries) };
}

export type LeadDetail = { lead: MktLeadDoc; store: LeadStore | null; events: MktEventDoc[] };

/** One lead with its store and its latest 50 events, or null. */
export async function getLead(id: string): Promise<LeadDetail | null> {
  const { mktLeads, mktEvents } = await collections();
  const lead = await mktLeads.findOne({ _id: id });
  if (!lead) return null;
  const [links, events] = await Promise.all([linkedStores([lead]), mktEvents.find({ leadId: id }).sort({ at: -1 }).limit(50).toArray()]);
  return { lead, store: links.get(id) ?? null, events };
}

async function suppress(handleKey: string, reason: "deleted" | "do_not_contact", now: Date): Promise<void> {
  const { mktSuppressions } = await collections();
  await mktSuppressions.updateOne({ _id: suppressionId(handleKey) }, { $set: { reason, at: now } }, { upsert: true });
}

/** Moves a lead to a stage. "Do not contact" also blocks the handle from future imports; leaving it lifts that. */
export async function setLeadStage(id: string, stage: LeadStage, actor: string, now: Date = new Date()): Promise<boolean> {
  const { mktLeads, mktEvents, mktSuppressions } = await collections();
  const before = await mktLeads.findOneAndUpdate({ _id: id }, { $set: { stage, stageChangedAt: now, updatedAt: now } }, { projection: { stage: 1, handleKey: 1 } });
  if (!before) return false;
  if (before.stage === stage) return true;
  await mktEvents.insertOne({ _id: randomUUID(), leadId: id, type: "stage_changed", from: before.stage, to: stage, actor, at: now });
  if (stage === "do_not_contact") await suppress(before.handleKey, "do_not_contact", now);
  else if (before.stage === "do_not_contact") await mktSuppressions.deleteOne({ _id: suppressionId(before.handleKey), reason: "do_not_contact" });
  return true;
}

/** Notes the lead was messaged now; a "new" lead becomes "contacted". */
export async function markLeadContacted(id: string, actor: string, now: Date = new Date()): Promise<boolean> {
  const { mktLeads, mktEvents } = await collections();
  const lead = await mktLeads.findOne({ _id: id }, { projection: { stage: 1 } });
  if (!lead) return false;
  if (lead.stage === "do_not_contact") return false;
  await mktLeads.updateOne({ _id: id }, { $set: { lastContactedAt: now, updatedAt: now } });
  await mktEvents.insertOne({ _id: randomUUID(), leadId: id, type: "contacted", from: null, to: null, actor, at: now });
  if (lead.stage === "new") await setLeadStage(id, "contacted", actor, now);
  return true;
}

/** Replaces the notes (cleaned, line breaks kept). The event records only that they changed. */
export async function setLeadNotes(id: string, notes: string, actor: string, now: Date = new Date()): Promise<boolean> {
  const { mktLeads, mktEvents } = await collections();
  const result = await mktLeads.updateOne({ _id: id }, { $set: { notes: cleanLeadNotes(notes), updatedAt: now } });
  if (result.matchedCount === 0) return false;
  await mktEvents.insertOne({ _id: randomUUID(), leadId: id, type: "notes_changed", from: null, to: null, actor, at: now });
  return true;
}

/** Deletes a lead and its events, and blocks the handle from future imports. */
export async function deleteLead(id: string, now: Date = new Date()): Promise<boolean> {
  const { mktLeads, mktEvents } = await collections();
  const lead = await mktLeads.findOne({ _id: id }, { projection: { handleKey: 1 } });
  if (!lead) return false;
  await suppress(lead.handleKey, "deleted", now);
  await mktLeads.deleteOne({ _id: id });
  await mktEvents.deleteMany({ leadId: id });
  return true;
}

export type LeadExportRow = MktLeadDoc & { store: LeadStore | null };

/** Every lead for the CSV download, most followers first. */
export async function leadsForExport(): Promise<LeadExportRow[]> {
  const { mktLeads } = await collections();
  const leads = await mktLeads.find({}).sort({ followers: -1, _id: 1 }).limit(20_000).toArray();
  const links = await linkedStores(leads);
  return leads.map((lead) => ({ ...lead, store: links.get(lead._id) ?? null }));
}
