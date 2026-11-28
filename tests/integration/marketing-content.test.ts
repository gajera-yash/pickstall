import { describe, expect, it } from "vitest";

// D-136 on a real MongoDB: one post per day and platform (a second run and a race write nothing new),
// rewriting keeps posted posts, status changes, real counts for building-in-public days, and the
// report's content section.

import { collections } from "@/lib/db/collections";
import { briefFor, contentStats, markPostPosted, postsForDays, saveContentSettings, setPostStatus, writeDayPosts } from "@/lib/marketing/content/posts";
import { DEFAULT_CONTENT_SETTINGS } from "@/lib/marketing/content/rules";
import { templateContentWriter } from "@/lib/marketing/content/writer";
import { buildDailyReport } from "@/lib/marketing/report";
import { reportWindow } from "@/lib/marketing/report-rules";

const DAY = "2026-11-28";

describe("daily posts", () => {
  it("writes one post per chosen platform, once, and keeps posted ones on rewrite", async () => {
    await saveContentSettings({ platforms: ["instagram", "x", "youtube"], shareRealNumbers: true, update: "" });

    const [first, racing] = await Promise.all([
      writeDayPosts(DAY, { replace: false }, new Date(), templateContentWriter),
      writeDayPosts(DAY, { replace: false }, new Date(), templateContentWriter),
    ]);
    expect(first.written + racing.written).toBe(3);
    const posts = await postsForDays([DAY]);
    expect(posts.map((post) => post.platform).sort()).toEqual(["instagram", "x", "youtube"]);
    const youtube = posts.find((post) => post.platform === "youtube");
    expect(youtube?.title).toBeTruthy();
    expect(youtube?.script).toBeTruthy();
    expect(posts.find((post) => post.platform === "instagram")?.text).toMatch(/#\w+/);

    expect((await writeDayPosts(DAY, { replace: false }, new Date(), templateContentWriter)).written).toBe(0);

    const x = posts.find((post) => post.platform === "x")!;
    expect(await markPostPosted(x._id, "https://x.com/pickstallstore/status/1")).toBe(true);
    expect(await markPostPosted(x._id, null)).toBe(false);
    const insta = posts.find((post) => post.platform === "instagram")!;
    expect(await setPostStatus(insta._id, "skipped")).toBe(true);

    const rewrite = await writeDayPosts(DAY, { replace: true }, new Date(), templateContentWriter);
    expect(rewrite).toMatchObject({ written: 1, kept: 2 });
    const { mktPosts } = await collections();
    expect(await mktPosts.findOne({ _id: x._id })).toMatchObject({ status: "posted", postedUrl: "https://x.com/pickstallstore/status/1" });

    expect(await setPostStatus(x._id, "draft")).toBe(true);
    expect(await mktPosts.findOne({ _id: x._id })).toMatchObject({ status: "draft", postedUrl: null });
    expect(await markPostPosted(x._id, null)).toBe(true);

    const report = await buildDailyReport(reportWindow(new Date("2026-11-28T10:00:00.000Z")));
    expect(report.content).toEqual({ written: 3, posted: 1, skipped: 1, notPosted: 1, postedOn: ["X (Twitter)"] });
  });

  it("uses real counts on building-in-public days, or a founder story when there is nothing to show", async () => {
    const empty = await contentStats();
    // Thursday 26 Nov 2026 is a building-in-public day.
    expect(briefFor("2026-11-26", DEFAULT_CONTENT_SETTINGS, empty, []).pillar).toBe("story");

    const { stores } = await collections();
    const now = new Date();
    await stores.insertMany(
      ["a", "b"].map((slug, index) => ({ _id: `store-${slug}`, ownerId: `owner-${slug}`, slug, isPublished: index === 0, createdAt: now, updatedAt: now })) as never,
    );
    const stats = await contentStats(now);
    expect(stats).toMatchObject({ creators: 2, liveStores: 1, newThisWeek: 2 });
    const brief = briefFor("2026-11-26", DEFAULT_CONTENT_SETTINGS, stats, []);
    expect(brief.pillar).toBe("build");
    expect(brief.numbers.map((item) => item.value)).toEqual([2, 1, 2]);
    expect(briefFor("2026-11-26", { ...DEFAULT_CONTENT_SETTINGS, shareRealNumbers: false }, stats, []).numbers).toEqual([]);
  });
});
