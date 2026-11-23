import { z } from "zod";

import { cleanText } from "@/lib/products/text";
import { HANDLE_RULES, normalizeHandle, type HandleKind } from "@/lib/stores/social-handles";

// Outreach leads (D-120): creators the founder plans to contact. Pure and client-safe: the import
// screen uses these rules for its preview and the server applies them again to every row.

/** Most rows one import file may hold, and the rows sent per request. */
export const LEAD_IMPORT_MAX_ROWS = 5_000;
export const LEAD_IMPORT_CHUNK = 1_000;
export const LEAD_IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024;

export const LEAD_PLATFORMS = ["instagram", "tiktok", "youtube", "x", "facebook", "linkedin", "other"] as const;
export type LeadPlatform = (typeof LEAD_PLATFORMS)[number];

export const LEAD_PLATFORM_LABELS: Record<LeadPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  other: "Other",
};

/** The store tool a lead uses today, from the "Current tool" column. */
export const LEAD_TOOLS = ["stan", "beacons", "linktree", "gumroad", "koji", "kajabi", "teachable", "podia", "payhip", "shopify", "none", "other"] as const;
export type LeadTool = (typeof LEAD_TOOLS)[number];

export const LEAD_TOOL_LABELS: Record<LeadTool, string> = {
  stan: "Stan Store",
  beacons: "Beacons",
  linktree: "Linktree",
  gumroad: "Gumroad",
  koji: "Koji",
  kajabi: "Kajabi",
  teachable: "Teachable",
  podia: "Podia",
  payhip: "Payhip",
  shopify: "Shopify",
  none: "None",
  other: "Other",
};

/**
 * Stages the founder sets. Signing up and what follows (store live, payments, sales, plan) are not
 * stages: they are read from the creator's store, so they are always true.
 */
export const LEAD_STAGES = ["new", "contacted", "replied", "interested", "call_booked", "not_interested", "do_not_contact"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  interested: "Interested",
  call_booked: "Call booked",
  not_interested: "Not interested",
  do_not_contact: "Do not contact",
};

export const LEAD_TEXT_MAX = { name: 80, country: 60, topic: 80, toolLabel: 60, contactMethod: 80, notes: 2_000 } as const;

/** Text from a file or a form: tags removed, spaces collapsed, cut to `max`. Null when empty. */
export function cleanLeadText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = cleanText(value).replace(/\s+/g, " ").trim().slice(0, max);
  return text || null;
}

/** Notes keep their line breaks (each line cleaned). */
export function cleanLeadNotes(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .split(/\r?\n/)
    .map((line) => cleanText(line).replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, LEAD_TEXT_MAX.notes);
  return text || null;
}

const PLATFORM_WORDS: [RegExp, LeadPlatform][] = [
  [/insta|^ig$/, "instagram"],
  [/tik ?tok/, "tiktok"],
  [/you ?tube|^yt$/, "youtube"],
  [/^x$|twitter|x\.com/, "x"],
  [/facebook|^fb$/, "facebook"],
  [/linked ?in/, "linkedin"],
];

/** The platform from the "Platform" column. Empty means Instagram (the list is Instagram creators). */
export function platformOf(raw: unknown): LeadPlatform {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!value) return "instagram";
  return PLATFORM_WORDS.find(([pattern]) => pattern.test(value))?.[1] ?? "other";
}

const isHandlePlatform = (platform: LeadPlatform): platform is LeadPlatform & HandleKind => platform !== "other";

/** A lower-case username (a pasted profile link or a leading @ is fine), or null when it is not one. */
export function leadHandleOf(platform: LeadPlatform, raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = isHandlePlatform(platform) ? normalizeHandle(platform, raw) : raw.trim().replace(/^@/, "");
  const handle = value.toLowerCase();
  return /^[a-z0-9._-]{1,50}$/.test(handle) ? handle : null;
}

/** One key per person: platform and username. */
export function leadHandleKey(platform: LeadPlatform, handle: string): string {
  return `${platform}:${handle}`;
}

/** The public profile link, or null for "other" platforms. */
export function leadProfileUrl(platform: LeadPlatform, handle: string): string | null {
  return isHandlePlatform(platform) ? HANDLE_RULES[platform].url(handle) : null;
}

/** Followers as a whole number: "12,500", "12.5K", "1.2M" and "3k" all work. Null when unreadable. */
export function followersOf(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.min(Math.round(raw), 10_000_000_000) : null;
  if (typeof raw !== "string") return null;
  const match = raw.trim().toLowerCase().replace(/,/g, "").match(/^(\d+(?:\.\d+)?)\s*([km])?\+?$/);
  if (!match) return null;
  const multiplier = match[2] === "m" ? 1_000_000 : match[2] === "k" ? 1_000 : 1;
  return Math.min(Math.round(Number(match[1]) * multiplier), 10_000_000_000);
}

/** "12.5K" style, for tables. */
export function formatFollowers(value: number | null): string {
  if (value === null) return "-";
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}K`;
  return String(value);
}

const TOOL_WORDS: [RegExp, LeadTool][] = [
  [/stan/, "stan"],
  [/beacons/, "beacons"],
  [/linktr/, "linktree"],
  [/gumroad/, "gumroad"],
  [/koji/, "koji"],
  [/kajabi/, "kajabi"],
  [/teachable/, "teachable"],
  [/podia/, "podia"],
  [/payhip/, "payhip"],
  [/shopify/, "shopify"],
  [/^(none|no|-|n\/a|na|nothing)$/, "none"],
];

/** The tool from the "Current tool" column; unknown names are "other" (the label is kept). */
export function toolOf(raw: unknown): LeadTool {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!value) return "none";
  return TOOL_WORDS.find(([pattern]) => pattern.test(value))?.[1] ?? "other";
}

const STAGE_WORDS: [RegExp, LeadStage][] = [
  [/do ?not|don'?t|stop|block|unsubscri/, "do_not_contact"],
  [/^(to ?(contact|dm|do|message)|not (yet )?contacted|not sent|pending|todo|new|lead|open)$/, "new"],
  [/not ?interested|declin|reject|lost|no thanks|^no$/, "not_interested"],
  [/call|meeting|booked|demo/, "call_booked"],
  [/interest|warm|hot|yes/, "interested"],
  [/repl|respond|answer/, "replied"],
  [/contact|sent|messag|dm'?d|reached|follow/, "contacted"],
];

/** A stage guessed from the list's own "Status" word; the founder confirms each one on import. */
export function stageGuess(raw: string): LeadStage {
  const value = raw.trim().toLowerCase();
  if (!value) return "new";
  return STAGE_WORDS.find(([pattern]) => pattern.test(value))?.[1] ?? "new";
}

/** Fields an import row can fill, in the order the mapping screen shows them. */
export const LEAD_FIELDS = ["name", "handle", "platform", "followers", "country", "topic", "tool", "contactMethod", "status", "notes"] as const;
export type LeadField = (typeof LEAD_FIELDS)[number];

export const LEAD_FIELD_LABELS: Record<LeadField, string> = {
  name: "Name",
  handle: "Handle",
  platform: "Platform",
  followers: "Followers",
  country: "Country",
  topic: "Course topic",
  tool: "Current tool",
  contactMethod: "Contact method",
  status: "Status",
  notes: "Notes",
};

const FIELD_HEADERS: Record<LeadField, RegExp> = {
  name: /^(full )?name$|creator name/,
  handle: /handle|username|user name|^ig$|instagram/,
  platform: /platform|network|channel/,
  followers: /follower|audience|subs/,
  country: /country|location|region/,
  topic: /topic|niche|category|course/,
  tool: /tool|store|current/,
  contactMethod: /contact/,
  status: /status|stage/,
  notes: /note|comment/,
};

/** Which column holds each field, by its header. -1 when none matches; a column is used once. */
export function guessLeadColumns(header: string[]): Record<LeadField, number> {
  const names = header.map((value) => value.trim().toLowerCase());
  const used = new Set<number>();
  const result = {} as Record<LeadField, number>;
  for (const field of LEAD_FIELDS) {
    const index = names.findIndex((name, i) => !used.has(i) && FIELD_HEADERS[field].test(name));
    result[field] = index;
    if (index !== -1) used.add(index);
  }
  return result;
}

/** A lead as the server keeps it after cleaning one import row. */
export type CleanLeadRow = {
  platform: LeadPlatform;
  handle: string;
  name: string | null;
  followers: number | null;
  country: string | null;
  topic: string | null;
  tool: LeadTool;
  toolLabel: string | null;
  contactMethod: string | null;
  stage: LeadStage;
  notes: string | null;
};

/** One import row, cleaned, or null without a valid handle. `stageFor` maps the list's status word. */
export function cleanLeadRow(raw: Partial<Record<LeadField, unknown>>, stageFor: (status: string) => LeadStage): CleanLeadRow | null {
  const platform = platformOf(raw.platform);
  const handle = leadHandleOf(platform, raw.handle);
  if (!handle) return null;
  const status = cleanLeadText(raw.status, 60) ?? "";
  return {
    platform,
    handle,
    name: cleanLeadText(raw.name, LEAD_TEXT_MAX.name),
    followers: followersOf(raw.followers),
    country: cleanLeadText(raw.country, LEAD_TEXT_MAX.country),
    topic: cleanLeadText(raw.topic, LEAD_TEXT_MAX.topic),
    tool: toolOf(raw.tool),
    toolLabel: cleanLeadText(raw.tool, LEAD_TEXT_MAX.toolLabel),
    contactMethod: cleanLeadText(raw.contactMethod, LEAD_TEXT_MAX.contactMethod),
    stage: stageFor(status),
    notes: cleanLeadNotes(raw.notes),
  };
}

const stage = z.enum(LEAD_STAGES);

/** What the import screen sends: mapped rows (raw strings), the status mapping and the file name. */
export const leadImportPayload = z.object({
  fileName: z.string().max(200),
  /** The 1-based row number in the file of the first row in this part, for error messages. */
  firstRow: z.number().int().min(2).max(LEAD_IMPORT_MAX_ROWS + 2),
  statusMap: z.record(z.string().max(60), stage).refine((map) => Object.keys(map).length <= 100, { error: "Too many different status values." }),
  rows: z
    .array(z.object(Object.fromEntries(LEAD_FIELDS.map((field) => [field, z.string().max(4_000).optional()])) as Record<LeadField, z.ZodOptional<z.ZodString>>))
    .min(1, { error: "The file has no rows to import." })
    .max(LEAD_IMPORT_CHUNK, { error: `Send up to ${LEAD_IMPORT_CHUNK} rows at a time.` }),
});
export type LeadImportPayload = z.input<typeof leadImportPayload>;

/** A status word as the mapping keys it: cleaned and lower case. */
export function statusKey(raw: unknown): string {
  return (cleanLeadText(raw, 60) ?? "").toLowerCase();
}

/** What the founder can change on a lead. */
export const leadUpdateInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("stage"), leadId: z.uuid(), stage }),
  z.object({ action: z.literal("notes"), leadId: z.uuid(), notes: z.string().max(LEAD_TEXT_MAX.notes * 2) }),
  z.object({ action: z.literal("contacted"), leadId: z.uuid() }),
]);
export type LeadUpdateInput = z.input<typeof leadUpdateInput>;

/** Our outreach link for a lead: the landing page with its code and the outreach tags (D-119). */
export function leadLink(appUrl: string, refCode: string, platform: LeadPlatform): string {
  const params = new URLSearchParams({ ref: refCode, utm_source: "outreach", utm_medium: platform === "other" ? "dm" : `${platform}_dm` });
  return `${appUrl.replace(/\/+$/, "")}/?${params.toString()}`;
}
