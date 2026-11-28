import { describe, expect, it, vi } from "vitest";

// D-136: the weekly topic rotation, the honesty checks on every post, the template (which must pass
// its own checks for every topic), the AI fallback rules, and the admin guard on the actions.

const guard = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const posts = vi.hoisted(() => ({
  writeDayPosts: vi.fn(),
  getPost: vi.fn(),
  updatePostText: vi.fn(),
  markPostPosted: vi.fn(),
  setPostStatus: vi.fn(),
  saveContentSettings: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/guard", () => guard);
vi.mock("@/lib/marketing/content/posts", () => posts);
vi.mock("@/lib/rate-limit", () => ({ rateLimitKey: (...parts: string[]) => parts.join(":"), takeRateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/env.server", () => ({ serverEnv: {} }));

import { GroqError } from "@/lib/marketing/ai/groq-writer";
import { markPostedAction, savePostAction, writeDayPostsAction } from "@/lib/marketing/content/actions";
import {
  allowedNumbers,
  cleanHashtags,
  contentSetProblem,
  contentSettingsInput,
  contentTextProblem,
  postedUrlOk,
  postTextFor,
  postThemeForDay,
  scheduleForDay,
  slideCount,
  tidySet,
  type ContentBrief,
  type ContentPillar,
  type ContentSet,
} from "@/lib/marketing/content/rules";
import { templateContent } from "@/lib/marketing/content/template";
import { TOPICS } from "@/lib/marketing/content/topics";
import { groqContentWriter, writeContent, type ContentWriter } from "@/lib/marketing/content/writer";

const POST_ID = "6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f";

function brief(overrides: Partial<ContentBrief> = {}): ContentBrief {
  const topic = TOPICS.tips[0]!;
  return { day: "2026-11-28", pillar: "tips", ...topic, numbers: [], update: null, voiceExamples: [], ...overrides };
}

describe("weekly rotation", () => {
  it("gives each weekday its pillar (India dates)", () => {
    // 23 Nov 2026 is a Monday.
    const week = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"].map((day) => scheduleForDay(day).pillar);
    expect(week).toEqual(["tips", "feature", "tips", "build", "fees", "tips", "story"]);
  });

  it("alternates the white and blue image looks day by day", () => {
    const looks = ["2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01"].map(postThemeForDay);
    expect(new Set(looks)).toEqual(new Set(["white", "blue"]));
    expect(looks[0]).not.toBe(looks[1]);
    expect(looks[0]).toBe(looks[2]);
  });

  it("uses a different tips topic on each tips day and moves on the next week", () => {
    const indexes = ["2026-11-23", "2026-11-25", "2026-11-28", "2026-11-30"].map((day) => scheduleForDay(day).index);
    expect(new Set(indexes).size).toBe(4);
    expect(scheduleForDay("2026-12-01").index).toBe(scheduleForDay("2026-11-24").index + 1);
  });
});

describe("honesty checks", () => {
  const allowed = allowedNumbers(brief({ numbers: [{ label: "Creators", value: 42 }] }));

  it("accepts our facts, our numbers and our own link", () => {
    expect(contentTextProblem("Starter is $19 a month. 0% from Pickstall; PayPal's processing fees still apply. pickstall.store", 500, allowed)).toBeNull();
    expect(contentTextProblem("42 creators have signed up so far. Thank you for building with me!", 500, allowed)).toBeNull();
  });

  it("rejects what we cannot back", () => {
    expect(contentTextProblem("Pickstall has 0% transaction fees for every creator out there.", 500, allowed)).toMatch(/PayPal/);
    expect(contentTextProblem("Over 5000 creators already sell with Pickstall every single day.", 500, allowed)).toMatch(/5000/);
    expect(contentTextProblem("Try the best store builder, see more at stan.store today please.", 500, allowed)).toMatch(/other than pickstall\.store/);
    expect(contentTextProblem("Write to me at founder@pickstall.store for a quick tour today.", 500, allowed)).toMatch(/email/);
    expect(contentTextProblem("Trusted by creators everywhere, a store that simply works for you.", 500, allowed)).toMatch(/claim/);
    expect(contentTextProblem("Checkout with Apple Pay in one tap, right from your link in bio.", 500, allowed)).toMatch(/checkout/);
    expect(contentTextProblem("Hi [name], here is a post with a placeholder left inside it.", 500, allowed)).toMatch(/placeholder/);
    expect(contentTextProblem("If you want a no‑fee platform to test this, try pickstall.store.", 500, allowed)).toMatch(/fee claim/);
    expect(contentTextProblem("Sell from one link with zero transaction fees, every single day.", 500, allowed)).toMatch(/fee claim/);
    expect(contentTextProblem("x".repeat(300), 270, allowed)).toMatch(/over 270/);
  });

  it("reads thousands separators and decimals as numbers", () => {
    expect(contentTextProblem("Gumroad charges 10% + $0.50 per sale, which adds up as you grow.", 500, allowed)).toBeNull();
    expect(contentTextProblem("We now have 1,200 stores and counting, which is wild to me.", 500, allowed)).toMatch(/1200/);
  });

  it("cleans hashtags and checks posted links", () => {
    expect(cleanHashtags(["#creatortips", "creatortips", "bad tag", "#1", "linkinbio"])).toEqual(["creatortips", "linkinbio"]);
    expect(postedUrlOk("x", "https://x.com/pickstallstore/status/1")).toBe(true);
    expect(postedUrlOk("x", "http://x.com/pickstallstore/status/1")).toBe(false);
    expect(postedUrlOk("linkedin", "https://evil.example/linkedin.com")).toBe(false);
    expect(postedUrlOk("youtube", "https://youtu.be/abc")).toBe(true);
  });

  it("only accepts known platforms and cleans the founder's update", () => {
    const parsed = contentSettingsInput.parse({ platforms: ["x", "instagram", "x"], shareRealNumbers: true, update: "  Shipped coupons <b>today</b>  " });
    expect(parsed.platforms).toEqual(["instagram", "x"]);
    expect(parsed.update).not.toContain("<");
    expect(contentSettingsInput.safeParse({ platforms: [], shareRealNumbers: false, update: "" }).success).toBe(false);
  });
});

describe("template posts", () => {
  const pillars = Object.keys(TOPICS) as Exclude<ContentPillar, "build">[];

  it.each(pillars.flatMap((pillar) => TOPICS[pillar].map((topic) => [pillar, topic.topic] as const)))("%s · %s passes every check", (pillar, name) => {
    const topic = TOPICS[pillar].find((item) => item.topic === name)!;
    const value = brief({ pillar, ...topic });
    const set = tidySet(templateContent(value));
    expect(contentSetProblem(set, allowedNumbers(value))).toBeNull();
  });

  it("a building-in-public day passes with real numbers and the founder's update", () => {
    const value = brief({
      pillar: "build",
      topic: "This week in building Pickstall",
      headline: "Building Pickstall in public: this week",
      points: ["Creators who have signed up so far: 37.", "Stores that are live: 12.", "This week: Shipped daily social posts."],
      numbers: [
        { label: "Creators who have signed up so far", value: 37 },
        { label: "Stores that are live", value: 12 },
      ],
      update: "Shipped daily social posts.",
    });
    const set = tidySet(templateContent(value));
    expect(contentSetProblem(set, allowedNumbers(value))).toBeNull();
    expect(set.linkedin).toContain("37");
  });

  it("puts hashtags on Instagram only and sizes the image sets", () => {
    const set = tidySet(templateContent(brief()));
    expect(postTextFor("instagram", set)).toMatch(/#creatortips/);
    expect(postTextFor("linkedin", set)).not.toMatch(/#/);
    expect(set.x.length).toBeLessThanOrEqual(270);
    expect(slideCount("instagram", set.slides)).toBe(set.slides.length + 2);
    expect(slideCount("x", set.slides)).toBe(1);
  });
});

function fakeWriter(sets: (ContentSet | Error)[]): ContentWriter & { calls: number } {
  const writer = {
    name: "groq" as const,
    model: "test-model",
    calls: 0,
    write: async () => {
      const next = sets[Math.min(writer.calls, sets.length - 1)]!;
      writer.calls += 1;
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return writer;
}

describe("AI writer and fallback", () => {
  const good = tidySet(templateContent(brief()));

  it("keeps a clean AI set", async () => {
    const result = await writeContent(brief(), fakeWriter([{ ...good, x: "A clean post about pricing your first product. pickstall.store" }]));
    expect(result).toMatchObject({ writer: "groq", model: "test-model", note: null });
    expect(result.set.x).toContain("pricing");
  });

  it("tries again once, then uses the template with a note", async () => {
    const writer = fakeWriter([{ ...good, linkedin: "Over 5000 creators love Pickstall and you will too, I promise you that." }]);
    const result = await writeContent(brief(), writer);
    expect(writer.calls).toBe(2);
    expect(result.writer).toBe("template");
    expect(result.note).toMatch(/5000/);
  });

  it("does not retry when Groq's limit is used up", async () => {
    const writer = fakeWriter([new GroqError("rate_limited", "Groq's free limit is used up for now.")]);
    const result = await writeContent(brief(), writer);
    expect(writer.calls).toBe(1);
    expect(result).toMatchObject({ writer: "template", note: expect.stringMatching(/limit/) });
  });

  it("parses Groq's JSON answer", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(good) } }] }), { status: 200 }));
    const set = await groqContentWriter("key", "model", fetchImpl as unknown as typeof fetch).write(brief());
    expect(set.headline).toBe(good.headline);
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as { response_format: { json_schema: { strict: boolean } } };
    expect(body.response_format.json_schema.strict).toBe(true);
  });
});

describe("content actions", () => {
  it("need an admin and valid input", async () => {
    guard.requireAdmin.mockRejectedValueOnce(new Error("NEXT_NOT_FOUND"));
    await expect(writeDayPostsAction({ day: "2026-11-28", replace: false })).rejects.toThrow();
    guard.requireAdmin.mockResolvedValue({ id: "admin-1", username: "founder" });
    expect(await writeDayPostsAction({ day: "28-11-2026", replace: false })).toEqual({ ok: false, error: "Pick a valid day." });
    expect(posts.writeDayPosts).not.toHaveBeenCalled();
  });

  it("refuses a posted link from another site", async () => {
    guard.requireAdmin.mockResolvedValue({ id: "admin-1", username: "founder" });
    posts.getPost.mockResolvedValue({ _id: POST_ID, platform: "x", status: "draft" });
    expect(await markPostedAction({ postId: POST_ID, url: "https://example.com/post" })).toMatchObject({ ok: false });
    expect(posts.markPostPosted).not.toHaveBeenCalled();
  });

  it("cleans and limits an edit before saving", async () => {
    guard.requireAdmin.mockResolvedValue({ id: "admin-1", username: "founder" });
    posts.getPost.mockResolvedValue({ _id: POST_ID, platform: "x", status: "draft", title: null, script: null });
    posts.updatePostText.mockResolvedValue(true);
    expect(await savePostAction({ postId: POST_ID, text: `  ${"a".repeat(400)}\u0007  ` })).toEqual({ ok: true, data: { message: "Saved." } });
    const saved = posts.updatePostText.mock.calls[0]?.[1] as { text: string };
    expect(saved.text.length).toBe(270);
    expect(saved.text).not.toContain("\u0007");
  });
});
