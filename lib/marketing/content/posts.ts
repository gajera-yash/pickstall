import "server-only";

import { randomUUID } from "node:crypto";

import { collections, type MktPostDoc } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { getGrowthSettings } from "@/lib/marketing/drafts";
import { configuredContentWriter, templateContentWriter, writeContent, type ContentWriter } from "@/lib/marketing/content/writer";
import {
  DEFAULT_CONTENT_SETTINGS,
  postTextFor,
  scheduleForDay,
  type ContentBrief,
  type ContentNumber,
  type ContentPlatform,
  type ContentSettings,
} from "@/lib/marketing/content/rules";
import { topicFor } from "@/lib/marketing/content/topics";

// Daily social posts (D-136). Platform-wide marketing data: used only behind requireAdmin (the
// Content page and its actions, the image route) and by the 08:00 IST job.

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getContentSettings(): Promise<ContentSettings> {
  const { mktSettings } = await collections();
  const doc = await mktSettings.findOne({ _id: "settings" }, { projection: { contentPlatforms: 1, contentShareNumbers: 1, contentUpdate: 1 } });
  return {
    platforms: doc?.contentPlatforms?.length ? doc.contentPlatforms : DEFAULT_CONTENT_SETTINGS.platforms,
    shareRealNumbers: doc?.contentShareNumbers ?? DEFAULT_CONTENT_SETTINGS.shareRealNumbers,
    update: doc?.contentUpdate ?? DEFAULT_CONTENT_SETTINGS.update,
  };
}

/** Saves already-cleaned content settings (contentSettingsInput); the DM settings stay as they are. */
export async function saveContentSettings(settings: ContentSettings, now: Date = new Date()): Promise<void> {
  const { mktSettings } = await collections();
  await mktSettings.updateOne(
    { _id: "settings" },
    {
      $set: { contentPlatforms: settings.platforms, contentShareNumbers: settings.shareRealNumbers, contentUpdate: settings.update, updatedAt: now },
      $setOnInsert: { voiceExamples: [], dailyDraftLimit: 30, dailyContactTarget: 15 },
    },
    { upsert: true },
  );
}

export type ContentStats = { creators: number; liveStores: number; newThisWeek: number; productsOnSale: number };

/** Real counts for "building in public" posts, straight from the database. */
export async function contentStats(now: Date = new Date()): Promise<ContentStats> {
  const { stores, products } = await collections();
  const notDeleted = { deletedAt: { $exists: false } };
  const [creators, liveStores, newThisWeek, productsOnSale] = await Promise.all([
    stores.countDocuments(notDeleted),
    stores.countDocuments({ ...notDeleted, isPublished: true }),
    stores.countDocuments({ ...notDeleted, createdAt: { $gte: new Date(now.getTime() - 7 * DAY_MS) } }),
    products.countDocuments({ status: "published" }),
  ]);
  return { creators, liveStores, newThisWeek, productsOnSale };
}

/** Only counts above zero, worded for a post. */
export function statsNumbers(stats: ContentStats): ContentNumber[] {
  const list: ContentNumber[] = [
    { label: "Creators who have signed up so far", value: stats.creators },
    { label: "Stores that are live", value: stats.liveStores },
    { label: "New signups in the last 7 days", value: stats.newThisWeek },
    { label: "Products on sale across all stores", value: stats.productsOnSale },
  ];
  return list.filter((item) => item.value > 0);
}

/**
 * The brief for a day: its pillar and topic from the weekly rotation. "Building in public" days use
 * the real counts (when the founder allows it and there is something to show); otherwise they fall
 * back to a founder story.
 */
export function briefFor(day: string, settings: ContentSettings, stats: ContentStats, voiceExamples: string[]): ContentBrief {
  const { pillar, index } = scheduleForDay(day);
  const update = settings.update.trim() || null;
  if (pillar === "build") {
    const numbers = settings.shareRealNumbers ? statsNumbers(stats) : [];
    if (numbers.length > 0 || update) {
      const points = numbers.map((item) => `${item.label}: ${item.value}.`);
      if (update) points.push(`This week: ${update}`.slice(0, 160));
      if (points.length < 3) points.push("I talk to creators every week and build what they ask for.", "Every number here comes straight from our database.");
      return { day, pillar, topic: "This week in building Pickstall", headline: "Building Pickstall in public: this week", points: points.slice(0, 5), numbers, update, voiceExamples };
    }
    const story = topicFor("story", index);
    return { day, pillar: "story", ...story, numbers: [], update, voiceExamples };
  }
  const topic = topicFor(pillar, index);
  return { day, pillar, ...topic, numbers: [], update: null, voiceExamples };
}

export type WriteDayResult = { written: number; kept: number; writer: "template" | "groq"; note: string | null };

/**
 * Writes the day's posts for the chosen platforms. Without `replace` it only fills platforms that have
 * no post yet (the 08:00 job and a second click do nothing new). With `replace` it rewrites posts
 * that are still drafts; posted and skipped ones are kept.
 */
export async function writeDayPosts(day: string, options: { replace: boolean }, now: Date = new Date(), writer: ContentWriter = configuredContentWriter()): Promise<WriteDayResult> {
  const { mktPosts } = await collections();
  const settings = await getContentSettings();
  const existing = await mktPosts.find({ day }, { projection: { _id: 1, platform: 1, status: 1 } }).toArray();
  const byPlatform = new Map(existing.map((post) => [post.platform, post]));
  const targets = settings.platforms.filter((platform) => {
    const post = byPlatform.get(platform);
    return !post || (options.replace && post.status === "draft");
  });
  const kept = settings.platforms.length - targets.length;
  if (targets.length === 0) return { written: 0, kept, writer: "template", note: null };

  const [stats, growth] = await Promise.all([contentStats(now), getGrowthSettings()]);
  const brief = briefFor(day, settings, stats, growth.voiceExamples);
  // Real numbers are posted in the template's exact wording: in testing the AI kept adding meaning the
  // numbers do not have ("for the founding program", "processing orders").
  const written = await writeContent(brief, brief.numbers.length > 0 ? templateContentWriter : writer);

  let count = 0;
  for (const platform of targets) {
    const fields = {
      pillar: brief.pillar,
      topic: brief.topic,
      headline: written.set.headline,
      slides: written.set.slides,
      text: postTextFor(platform, written.set),
      title: platform === "youtube" ? written.set.youtubeTitle : null,
      script: platform === "youtube" ? written.set.youtubeScript : null,
      writer: written.writer,
      model: written.model,
      note: written.note,
      updatedAt: now,
    };
    const current = byPlatform.get(platform);
    if (current) {
      const result = await mktPosts.updateOne({ _id: current._id, status: "draft" }, { $set: fields });
      count += result.modifiedCount;
      continue;
    }
    try {
      await mktPosts.insertOne({ _id: randomUUID(), day, platform, ...fields, status: "draft", postedUrl: null, createdAt: now });
      count += 1;
    } catch (error) {
      // The job and a click raced: the other one already wrote this platform's post.
      if (!isDuplicateKeyError(error)) throw error;
    }
  }
  return { written: count, kept, writer: written.writer, note: written.note };
}

/** Posts of the given days, newest day first, platforms in the fixed order. */
export async function postsForDays(days: string[]): Promise<MktPostDoc[]> {
  if (days.length === 0) return [];
  const { mktPosts } = await collections();
  return mktPosts.find({ day: { $in: days } }).sort({ day: -1, platform: 1 }).limit(200).toArray();
}

export async function getPost(id: string): Promise<MktPostDoc | null> {
  const { mktPosts } = await collections();
  return mktPosts.findOne({ _id: id });
}

/** Saves the founder's edit (already cleaned). Only drafts can change. */
export async function updatePostText(id: string, fields: { text: string; title?: string | null; script?: string | null }, now: Date = new Date()): Promise<boolean> {
  const { mktPosts } = await collections();
  const set: Partial<MktPostDoc> = { text: fields.text, updatedAt: now };
  if (fields.title !== undefined) set.title = fields.title;
  if (fields.script !== undefined) set.script = fields.script;
  const result = await mktPosts.updateOne({ _id: id, status: "draft" }, { $set: set });
  return result.matchedCount === 1;
}

/** Marks a draft as posted, with the post's link when the founder has it. */
export async function markPostPosted(id: string, postedUrl: string | null, now: Date = new Date()): Promise<boolean> {
  const { mktPosts } = await collections();
  const result = await mktPosts.updateOne({ _id: id, status: "draft" }, { $set: { status: "posted", postedUrl, postedAt: now, updatedAt: now } });
  return result.modifiedCount === 1;
}

/** Skips a draft for today, or brings a skipped or posted post back to draft (a mistake undone). */
export async function setPostStatus(id: string, status: "skipped" | "draft", now: Date = new Date()): Promise<boolean> {
  const { mktPosts } = await collections();
  const result =
    status === "skipped"
      ? await mktPosts.updateOne({ _id: id, status: "draft" }, { $set: { status, updatedAt: now } })
      : await mktPosts.updateOne({ _id: id, status: { $in: ["skipped", "posted"] } }, { $set: { status, postedUrl: null, updatedAt: now }, $unset: { postedAt: "" } });
  return result.modifiedCount === 1;
}

export type ContentPlatformStatus = { platform: ContentPlatform; status: MktPostDoc["status"] };
