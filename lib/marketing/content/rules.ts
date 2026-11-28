import { z } from "zod";

import { FOUNDING_MONTHS, FOUNDING_SPOTS, PLANNED_PRICE_CENTS, TRIAL_DAYS } from "@/lib/config";
import { cleanLeadNotes } from "@/lib/marketing/leads-rules";

// Daily social posts (D-136, marketing block M7a). Client-safe and pure: the platforms, the weekly
// topic rotation, the per-platform limits and the honesty checks every post passes (PRD section 2.6).

export const CONTENT_PLATFORMS = ["instagram", "facebook", "linkedin", "x", "youtube"] as const;
export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

export const CONTENT_PLATFORM_LABELS: Record<ContentPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X (Twitter)",
  youtube: "YouTube Shorts",
};

/** Where the founder posts by hand (M7a). Plain pages, no text in the URL. */
export const CONTENT_POST_URLS: Record<ContentPlatform, string> = {
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
  linkedin: "https://www.linkedin.com/feed/",
  x: "https://x.com/compose/post",
  youtube: "https://studio.youtube.com/",
};

/** The image set each platform gets: a portrait carousel (cover, points, closing card) or one wide cover. */
export const CONTENT_IMAGE_FORMAT: Record<ContentPlatform, "carousel" | "wide"> = {
  instagram: "carousel",
  facebook: "carousel",
  linkedin: "carousel",
  x: "wide",
  youtube: "wide",
};

export const CONTENT_PILLARS = ["tips", "feature", "build", "fees", "story"] as const;
export type ContentPillar = (typeof CONTENT_PILLARS)[number];

export const CONTENT_PILLAR_LABELS: Record<ContentPillar, string> = {
  tips: "Creator tips",
  feature: "Feature demo",
  build: "Building in public",
  fees: "Honest fee math",
  story: "Founder story",
};

export const POST_STATUSES = ["draft", "posted", "skipped"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/** Character limits per field. X counts every link as 23 characters, so its limit leaves room. */
export const CONTENT_LIMITS = {
  headline: 70,
  slide: 160,
  slidesMin: 3,
  slidesMax: 5,
  x: 270,
  linkedin: 2_000,
  instagram: 1_800,
  facebook: 1_500,
  youtubeTitle: 90,
  youtubeDescription: 800,
  youtubeScript: 900,
  hashtagsMin: 3,
  hashtagsMax: 8,
  update: 600,
} as const;

/** Most characters a post's main text may have on each platform (the founder's edits too). */
export const POST_TEXT_MAX: Record<ContentPlatform, number> = {
  instagram: CONTENT_LIMITS.instagram + 300,
  facebook: CONTENT_LIMITS.facebook,
  linkedin: CONTENT_LIMITS.linkedin,
  x: CONTENT_LIMITS.x,
  youtube: CONTENT_LIMITS.youtubeDescription,
};

// ---------------------------------------------------------------------------------------------
// The day's topic: a fixed weekly rotation (India dates), so every pillar comes back each week.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_PILLAR: ContentPillar[] = ["story", "tips", "feature", "tips", "build", "fees", "tips"]; // Sun..Sat
const TIPS_SLOT: Record<number, number> = { 1: 0, 3: 1, 6: 2 };

export function isContentDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** The pillar of a day and which entry of that pillar's list it uses (rotates week by week). */
export function scheduleForDay(day: string): { pillar: ContentPillar; index: number } {
  const date = new Date(`${day}T00:00:00Z`);
  const dayNumber = Math.floor(date.getTime() / DAY_MS);
  // 1970-01-01 was a Thursday: +3 makes weeks start on Monday.
  const week = Math.floor((dayNumber + 3) / 7);
  const weekday = date.getUTCDay();
  const pillar = WEEKDAY_PILLAR[weekday] ?? "tips";
  const index = pillar === "tips" ? week * 3 + (TIPS_SLOT[weekday] ?? 0) : week;
  return { pillar, index };
}

/** The look of a day's images: white and brand blue on alternating days, so the grid stays varied. */
export function postThemeForDay(day: string): "white" | "blue" {
  const dayNumber = Math.floor(new Date(`${day}T00:00:00Z`).getTime() / DAY_MS);
  return dayNumber % 2 === 0 ? "white" : "blue";
}

// ---------------------------------------------------------------------------------------------
// Settings for the content agent, stored with the Growth settings.

export const DEFAULT_CONTENT_SETTINGS = {
  /** Facebook is off until the founder has a Page. */
  platforms: ["instagram", "linkedin", "x", "youtube"] as ContentPlatform[],
  /** Real counts from the database in "building in public" posts (the founder said yes, 2026-11-28). */
  shareRealNumbers: true,
  /** The founder's own note on what happened this week; the only source for "what shipped". */
  update: "",
};
export type ContentSettings = typeof DEFAULT_CONTENT_SETTINGS;

export const contentSettingsInput = z.object({
  platforms: z
    .array(z.enum(CONTENT_PLATFORMS))
    .min(1, { error: "Pick at least one platform." })
    .transform((list) => CONTENT_PLATFORMS.filter((platform) => list.includes(platform))),
  shareRealNumbers: z.boolean(),
  update: z
    .string()
    .max(CONTENT_LIMITS.update * 2)
    .transform((text) => (cleanLeadNotes(text) ?? "").slice(0, CONTENT_LIMITS.update)),
});
export type ContentSettingsInput = z.input<typeof contentSettingsInput>;

// ---------------------------------------------------------------------------------------------
// What the writer gets and returns.

export type ContentNumber = { label: string; value: number };

export type ContentBrief = {
  day: string;
  pillar: ContentPillar;
  topic: string;
  headline: string;
  points: string[];
  /** Real counts the posts may quote (empty when the founder turned numbers off). */
  numbers: ContentNumber[];
  update: string | null;
  voiceExamples: string[];
};

export type ContentSet = {
  headline: string;
  slides: string[];
  x: string;
  linkedin: string;
  instagram: string;
  facebook: string;
  youtubeTitle: string;
  youtubeDescription: string;
  youtubeScript: string;
  hashtags: string[];
};

export const contentSetSchema = z.object({
  headline: z.string().min(1).max(400),
  slides: z.array(z.string().min(1).max(600)).min(1).max(8),
  x: z.string().min(1).max(2_000),
  linkedin: z.string().min(1).max(6_000),
  instagram: z.string().min(1).max(6_000),
  facebook: z.string().min(1).max(6_000),
  youtubeTitle: z.string().min(1).max(400),
  youtubeDescription: z.string().min(1).max(4_000),
  youtubeScript: z.string().min(1).max(4_000),
  hashtags: z.array(z.string().max(80)).max(20),
});

// ---------------------------------------------------------------------------------------------
// Honesty checks (D-136): only facts we can back, numbers only from the brief, links only to us.

const PRICE = (cents: number) => Math.round(cents / 100);

/** Numbers that are always fine: small counts, our prices and offers, competitor prices in our facts, years. */
export const BASE_NUMBERS: readonly number[] = [
  ...Array.from({ length: 11 }, (_, value) => value),
  PRICE(PLANNED_PRICE_CENTS.starter),
  PRICE(PLANNED_PRICE_CENTS.pro),
  TRIAL_DAYS,
  FOUNDING_SPOTS,
  FOUNDING_MONTHS,
  99, // Stan Store Creator Pro, a month (lib/marketing/ai/facts.ts)
  0.5, // Gumroad's $0.50 per sale
  2025,
  2026,
  2027,
];

function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d+(?:[.,]\d+)*/g)].map((match) => {
    const raw = match[0];
    // "1,200" is a thousands separator; "0.50" a decimal.
    const normal = /^\d{1,3}(,\d{3})+$/.test(raw) ? raw.replace(/,/g, "") : raw.replace(",", ".");
    return Number.parseFloat(normal);
  });
}

/** Every number the posts of this brief may contain. */
export function allowedNumbers(brief: Pick<ContentBrief, "numbers" | "update" | "points" | "headline">): Set<number> {
  const allowed = new Set<number>(BASE_NUMBERS);
  for (const item of brief.numbers) allowed.add(item.value);
  for (const text of [brief.update ?? "", brief.headline, ...brief.points]) for (const value of numbersIn(text)) allowed.add(value);
  return allowed;
}

const BANNED: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.]+/, "contains an email address"],
  [/\[[^\]]*\]|\{[^}]*\}|<[^>]*>/, "contains a placeholder or markup"],
  [/\btax(es)?\b|\bvat\b|\bgst\b/i, "mentions tax"],
  [/guarantee|risk[- ]free|100% (free|safe)|testimonial|trusted by|thousands of creators|best in the world|#1 /i, "makes a claim we cannot back"],
  [/apple pay|google pay|credit card checkout|card checkout|stripe/i, "promises a checkout we do not offer"],
  // Plans cost money and PayPal charges its fee: only "0% transaction fees" (with PayPal) is true.
  [/\bno[-‐-―\s]fees?\b|\bfee[-‐-―\s]free\b|\bzero[-‐-―\s](transaction[-‐-―\s])?fees?\b|\bwithout (any )?fees\b|\bfree forever\b/i, "makes a fee claim we cannot back"],
];

const DOMAIN = /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|store|io|ai|co|net|org|app|link|me|ly|gg|in))\b/gi;

/** The reason a text breaks a rule, or null when it is fine. */
export function contentTextProblem(text: string, max: number, allowed: Set<number>, min = 20): string | null {
  const value = text.trim();
  if (value.length < min) return "is too short";
  if (value.length > max) return `is over ${max} characters`;
  for (const [pattern, reason] of BANNED) if (pattern.test(value)) return reason;
  for (const match of value.matchAll(DOMAIN)) {
    if ((match[1] ?? "").toLowerCase() !== "pickstall.store") return "links to a site other than pickstall.store";
  }
  if (/\b0 ?%/.test(value) && !/paypal/i.test(value)) return "says 0% without PayPal's processing fees";
  const invented = numbersIn(value).find((number) => !allowed.has(number));
  if (invented !== undefined) return `uses a number we did not give it (${invented})`;
  return null;
}

const HASHTAG = /^[A-Za-z][A-Za-z0-9_]{1,29}$/;

/** Hashtags without "#", deduplicated, kept only when they are plain words. */
export function cleanHashtags(list: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of list) {
    const tag = raw.trim().replace(/^#+/, "");
    if (!HASHTAG.test(tag) || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    result.push(tag);
  }
  return result.slice(0, CONTENT_LIMITS.hashtagsMax);
}

/** The reason a whole content set breaks a rule, or null. */
export function contentSetProblem(set: ContentSet, allowed: Set<number>): string | null {
  const L = CONTENT_LIMITS;
  const checks: [string, string, number, number?][] = [
    ["Headline", set.headline, L.headline, 10],
    ...set.slides.map((slide, index): [string, string, number, number] => [`Slide ${index + 1}`, slide, L.slide, 10]),
    ["X post", set.x, L.x],
    ["LinkedIn post", set.linkedin, L.linkedin],
    ["Instagram caption", set.instagram, L.instagram],
    ["Facebook post", set.facebook, L.facebook],
    ["YouTube title", set.youtubeTitle, L.youtubeTitle, 10],
    ["YouTube description", set.youtubeDescription, L.youtubeDescription],
    ["YouTube script", set.youtubeScript, L.youtubeScript],
  ];
  if (set.slides.length < L.slidesMin || set.slides.length > L.slidesMax) return `Has ${set.slides.length} slides (needs ${L.slidesMin} to ${L.slidesMax})`;
  for (const [label, text, max, min] of checks) {
    const problem = contentTextProblem(text, max, allowed, min);
    if (problem) return `${label} ${problem}`;
  }
  if (cleanHashtags(set.hashtags).length < L.hashtagsMin) return `Has fewer than ${L.hashtagsMin} usable hashtags`;
  return null;
}

/** Trims lines and collapses runs of blank lines. */
export function tidyText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function tidySet(set: ContentSet): ContentSet {
  return {
    headline: tidyText(set.headline).replace(/\n+/g, " "),
    slides: set.slides.map((slide) => tidyText(slide).replace(/\n+/g, " ")).filter(Boolean),
    x: tidyText(set.x),
    linkedin: tidyText(set.linkedin),
    instagram: tidyText(set.instagram),
    facebook: tidyText(set.facebook),
    youtubeTitle: tidyText(set.youtubeTitle).replace(/\n+/g, " "),
    youtubeDescription: tidyText(set.youtubeDescription),
    youtubeScript: tidyText(set.youtubeScript),
    hashtags: cleanHashtags(set.hashtags),
  };
}

/** The text the founder copies for one platform. Instagram gets its hashtags at the end. */
export function postTextFor(platform: ContentPlatform, set: ContentSet): string {
  switch (platform) {
    case "instagram":
      return `${set.instagram}\n\n${set.hashtags.map((tag) => `#${tag}`).join(" ")}`.trim();
    case "facebook":
      return set.facebook;
    case "linkedin":
      return set.linkedin;
    case "x":
      return set.x;
    case "youtube":
      return set.youtubeDescription;
  }
}

/** Cleans a post the founder edited: tidy lines, no control characters, within the platform's limit. */
export function cleanPostText(platform: ContentPlatform, text: string): string {
  return tidyText(text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")).slice(0, POST_TEXT_MAX[platform]);
}

/** The images of a post: cover, one per point and a closing card (carousel), or just the cover. */
export function slideCount(platform: ContentPlatform, slides: string[]): number {
  return CONTENT_IMAGE_FORMAT[platform] === "carousel" ? slides.length + 2 : 1;
}

/** A posted link must be https on the platform's own site. */
export function postedUrlOk(platform: ContentPlatform, value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const hosts: Record<ContentPlatform, string[]> = {
    instagram: ["instagram.com"],
    facebook: ["facebook.com", "fb.com", "fb.watch"],
    linkedin: ["linkedin.com", "lnkd.in"],
    x: ["x.com", "twitter.com"],
    youtube: ["youtube.com", "youtu.be"],
  };
  const host = url.hostname.toLowerCase();
  return hosts[platform].some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}
